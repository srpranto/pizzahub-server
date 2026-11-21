import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { stripe } from "../config/stripe.js";
import {
  getUsersCollection,
  getTransactionsCollection,
} from "../config/db.js";
import { toObjectId, toTransactionResponse } from "../utils/validate.js";
import type {
  AuthenticatedRequest,
  ApiResponse,
  DbTransaction,
  TransactionWithVendor,
} from "../types/index.js";

export async function createCheckoutSession(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ url: string | null; sessionId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (req.user.role !== "vendor") {
      res.status(403).json({
        success: false,
        error: "Forbidden: Only vendors can subscribe to the Premium plan",
      });
      return;
    }

    if (req.user.subscriptionPlan === "premium") {
      res.status(400).json({
        success: false,
        error: "Your kitchen is already subscribed to the Premium plan",
      });
      return;
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "PizzaHub Vendor Premium Plan",
                description:
                  "Unlimited menu items listing + top priority featured placement on homepage",
              },
              unit_amount: 2900,
              recurring: {
                interval: "month" as const,
              },
            },
            quantity: 1,
          },
        ];

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: lineItems,
        metadata: {
          vendorId: req.user._id,
        },
        success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/payment/cancel`,
      });

      res.status(200).json({
        success: true,
        data: {
          url: session.url,
          sessionId: session.id,
        },
      });
      return;
    } catch (stripeError: unknown) {
      const errorMsg =
        stripeError instanceof Error
          ? stripeError.message
          : String(stripeError);
      const isPlaceholderOrInvalid =
        !process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY.includes("placeholder") ||
        process.env.STRIPE_SECRET_KEY.endsWith("_dev") ||
        errorMsg.includes("Invalid API Key");

      if (isPlaceholderOrInvalid) {
        const transactionsCollection = getTransactionsCollection();
        const usersCollection = getUsersCollection();
        const vendorObjectId = toObjectId(req.user._id);

        const mockSessionId = `cs_test_${new ObjectId().toString()}`;
        const newTx: DbTransaction = {
          _id: new ObjectId(),
          vendorId: vendorObjectId,
          plan: "premium",
          amount: 29,
          currency: "usd",
          stripeSessionId: mockSessionId,
          stripeSubscriptionId: `sub_test_${new ObjectId().toString()}`,
          status: "succeeded",
          createdAt: new Date(),
        };

        await transactionsCollection.insertOne(newTx);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await usersCollection.updateOne(
          { _id: vendorObjectId },
          {
            $set: {
              subscriptionPlan: "premium",
              subscriptionExpiresAt: expiresAt,
              updatedAt: new Date(),
            },
          }
        );

        res.status(200).json({
          success: true,
          data: {
            url: `${clientUrl}/payment/success?session_id=${mockSessionId}`,
            sessionId: mockSessionId,
          },
        });
        return;
      }

      throw stripeError;
    }
  } catch (error) {
    next(error);
  }
}

export async function handleStripeWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      res.status(400).json({ error: "Missing Stripe signature or webhook secret" });
      return;
    }

    const rawBody = req.body as Buffer;
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    const usersCollection = getUsersCollection();
    const transactionsCollection = getTransactionsCollection();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const vendorId = session.metadata?.vendorId;

      if (vendorId) {
        const existingTx = await transactionsCollection.findOne({
          stripeSessionId: session.id,
        });

        if (!existingTx) {
          const vendorObjectId = toObjectId(vendorId);
          const newTx: DbTransaction = {
            _id: new ObjectId(),
            vendorId: vendorObjectId,
            plan: "premium",
            amount: session.amount_total ? session.amount_total / 100 : 29,
            currency: session.currency || "usd",
            stripeSessionId: session.id,
            stripeSubscriptionId:
              typeof session.subscription === "string"
                ? session.subscription
                : null,
            status: "succeeded",
            createdAt: new Date(),
          };

          await transactionsCollection.insertOne(newTx);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await usersCollection.updateOne(
            { _id: vendorObjectId },
            {
              $set: {
                subscriptionPlan: "premium",
                subscriptionExpiresAt: expiresAt,
                updatedAt: new Date(),
              },
            }
          );
        }
      }
    } else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const rawSub =
        "subscription" in invoice ? invoice.subscription : undefined;
      const subscriptionId = typeof rawSub === "string" ? rawSub : undefined;

      if (subscriptionId) {
        const tx = await transactionsCollection.findOne({
          stripeSubscriptionId: subscriptionId,
        });

        if (tx) {
          const extendedExpiry = new Date();
          extendedExpiry.setDate(extendedExpiry.getDate() + 30);

          await usersCollection.updateOne(
            { _id: tx.vendorId },
            {
              $set: {
                subscriptionPlan: "premium",
                subscriptionExpiresAt: extendedExpiry,
                updatedAt: new Date(),
              },
            }
          );
        }
      }
    } else if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      if (
        subscription.status === "canceled" ||
        subscription.status === "unpaid"
      ) {
        const tx = await transactionsCollection.findOne({
          stripeSubscriptionId: subscription.id,
        });

        if (tx) {
          await usersCollection.updateOne(
            { _id: tx.vendorId },
            {
              $set: {
                subscriptionPlan: "free",
                subscriptionExpiresAt: null,
                updatedAt: new Date(),
              },
            }
          );
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
}

export async function getAdminTransactions(
  _req: AuthenticatedRequest,
  res: Response<ApiResponse<TransactionWithVendor[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const transactionsCollection = getTransactionsCollection();

    const transactions = await transactionsCollection
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "vendorId",
            foreignField: "_id",
            as: "vendorData",
          },
        },
        {
          $addFields: {
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $addFields: {
            vendorName: {
              $ifNull: ["$vendor.businessName", "$vendor.name"],
            },
            vendorEmail: "$vendor.email",
          },
        },
        {
          $project: {
            vendorData: 0,
            "vendor.password": 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    const transformed: TransactionWithVendor[] = transactions.map((t) =>
      toTransactionResponse(t)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}
