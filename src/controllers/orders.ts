import type { Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import {
  getOrdersCollection,
  getMenuItemsCollection,
  getUsersCollection,
} from "../config/db.js";
import { sendOrderStatusNotificationEmail } from "../utils/email.js";
import {
  isValidObjectId,
  toObjectId,
  isValidIsoDate,
  toOrderResponse,
} from "../utils/validate.js";
import type {
  AuthenticatedRequest,
  ApiResponse,
  DbOrder,
  OrderStatus,
  OrderWithDetails,
} from "../types/index.js";

export async function placeOrder(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<unknown>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (req.user.role !== "customer" && req.user.role !== "vendor") {
      res.status(403).json({
        success: false,
        error: "Forbidden: Only customer and vendor accounts can place orders",
      });
      return;
    }

    const { itemId, items, deliveryDate, deliveryAddress, message } = req.body as {
      itemId?: string;
      items?: Array<{ itemId: string; quantity?: number; message?: string }>;
      deliveryDate?: string;
      deliveryAddress?: string;
      message?: string;
    };

    if (!deliveryDate || !isValidIsoDate(deliveryDate)) {
      res.status(400).json({
        success: false,
        error: "Valid delivery date required in YYYY-MM-DD format",
      });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    if (deliveryDate < today) {
      res.status(400).json({
        success: false,
        error: "Delivery date must be today or in the future",
      });
      return;
    }

    if (
      !deliveryAddress ||
      typeof deliveryAddress !== "string" ||
      deliveryAddress.trim().length < 5
    ) {
      res.status(400).json({
        success: false,
        error: "Delivery address must be at least 5 characters",
      });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const ordersCollection = getOrdersCollection();
    const customerObjectId = toObjectId(req.user._id);
    const now = new Date();

    // Support batch order (multiple pizzas from cart)
    if (Array.isArray(items) && items.length > 0) {
      const ordersToInsert: DbOrder[] = [];

      for (const cartItem of items) {
        if (!cartItem.itemId || !isValidObjectId(cartItem.itemId)) {
          res.status(400).json({ success: false, error: "Valid item ID required for each cart item" });
          return;
        }

        const itemObjId = toObjectId(cartItem.itemId);
        const menuItem = await menuCollection.findOne({ _id: itemObjId });

        if (!menuItem || menuItem.status !== "approved") {
          res.status(404).json({
            success: false,
            error: `Pizza item not found or is currently not approved for ordering`,
          });
          return;
        }

        if (menuItem.vendorId.toString() === req.user._id) {
          res.status(403).json({
            success: false,
            error: "Vendors cannot place orders for their own items",
          });
          return;
        }

        const duplicate = await ordersCollection.findOne({
          customerId: customerObjectId,
          itemId: itemObjId,
          deliveryDate,
          status: { $in: ["pending", "accepted"] },
        });

        if (duplicate) {
          res.status(409).json({
            success: false,
            error: `You already have an active order for "${menuItem.itemName}" on ${deliveryDate}`,
          });
          return;
        }

        const qty = Math.max(1, Math.min(Number(cartItem.quantity) || 1, 99));
        const itemMsg = cartItem.message?.trim() || message?.trim();

        ordersToInsert.push({
          _id: new ObjectId(),
          itemId: itemObjId,
          vendorId: menuItem.vendorId,
          customerId: customerObjectId,
          deliveryDate,
          deliveryAddress: deliveryAddress.trim(),
          message: itemMsg || undefined,
          quantity: qty,
          status: "pending",
          statusHistory: [{ status: "pending", at: now }],
          createdAt: now,
        });
      }

      await ordersCollection.insertMany(ordersToInsert);

      res.status(201).json({
        success: true,
        data: ordersToInsert.map((o) => ({
          ...o,
          id: o._id.toString(),
        })),
        message: `${ordersToInsert.length} pizza order(s) placed successfully`,
      });
      return;
    }

    // Classic single-item order
    if (!itemId || !isValidObjectId(itemId)) {
      res.status(400).json({ success: false, error: "Valid item ID required" });
      return;
    }

    const itemObjectId = toObjectId(itemId);
    const item = await menuCollection.findOne({ _id: itemObjectId });

    if (!item || item.status !== "approved") {
      res.status(404).json({
        success: false,
        error: "Pizza item not found or is currently not approved for ordering",
      });
      return;
    }

    if (item.vendorId.toString() === req.user._id) {
      res.status(403).json({
        success: false,
        error: "Vendors cannot place orders for their own items",
      });
      return;
    }

    const duplicateOrder = await ordersCollection.findOne({
      customerId: customerObjectId,
      itemId: itemObjectId,
      deliveryDate,
      status: { $in: ["pending", "accepted"] },
    });

    if (duplicateOrder) {
      res.status(409).json({
        success: false,
        error:
          "You already have an active order for this pizza on the selected date",
      });
      return;
    }

    const qty = Math.max(1, Math.min(Number((req.body as { quantity?: number }).quantity) || 1, 99));
    const newOrder: Omit<DbOrder, "_id"> = {
      itemId: itemObjectId,
      vendorId: item.vendorId,
      customerId: customerObjectId,
      deliveryDate,
      deliveryAddress: deliveryAddress.trim(),
      message: message ? message.trim() : undefined,
      quantity: qty,
      status: "pending",
      statusHistory: [{ status: "pending", at: now }],
      createdAt: now,
    };

    const insertResult = await ordersCollection.insertOne(newOrder as DbOrder);

    res.status(201).json({
      success: true,
      data: {
        ...newOrder,
        id: insertResult.insertedId.toString(),
        _id: insertResult.insertedId,
      },
      message: "Order placed successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerOrders(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<OrderWithDetails[]>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const customerObjectId = toObjectId(req.user._id);
    const ordersCollection = getOrdersCollection();

    const orders = await ordersCollection
      .aggregate([
        { $match: { customerId: customerObjectId } },
        {
          $lookup: {
            from: "menuItems",
            let: { targetItemId: "$itemId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$targetItemId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$targetItemId" }] },
                    ],
                  },
                },
              },
            ],
            as: "itemData",
          },
        },
        {
          $lookup: {
            from: "users",
            let: { targetVendorId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$targetVendorId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$targetVendorId" }] },
                    ],
                  },
                },
              },
            ],
            as: "vendorData",
          },
        },
        {
          $addFields: {
            item: { $arrayElemAt: ["$itemData", 0] },
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $addFields: {
            vendorName: {
              $ifNull: ["$vendor.businessName", "$vendor.name"],
            },
          },
        },
        {
          $project: {
            itemData: 0,
            vendorData: 0,
            "vendor.password": 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    const transformed: OrderWithDetails[] = orders.map((o) =>
      toOrderResponse(o)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelCustomerOrder(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ status: OrderStatus }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    const orderObjectId = toObjectId(id);
    const customerObjectId = toObjectId(req.user._id);
    const ordersCollection = getOrdersCollection();

    const order = await ordersCollection.findOne({
      _id: orderObjectId,
      customerId: customerObjectId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: "Order not found or you do not have permission to cancel it",
      });
      return;
    }

    if (order.status !== "pending") {
      res.status(400).json({
        success: false,
        error: "Only pending orders can be cancelled",
      });
      return;
    }

    const now = new Date();
    await ordersCollection.updateOne(
      { _id: orderObjectId },
      {
        $set: { status: "cancelled" },
        $push: { statusHistory: { status: "cancelled", at: now } },
      }
    );

    res.status(200).json({
      success: true,
      data: { status: "cancelled" },
      message: "Order cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getVendorOrders(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<OrderWithDetails[]>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const vendorObjectId = toObjectId(req.user._id);
    const ordersCollection = getOrdersCollection();

    const orders = await ordersCollection
      .aggregate([
        { $match: { vendorId: vendorObjectId } },
        {
          $lookup: {
            from: "menuItems",
            let: { targetItemId: "$itemId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$targetItemId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$targetItemId" }] },
                    ],
                  },
                },
              },
            ],
            as: "itemData",
          },
        },
        {
          $lookup: {
            from: "users",
            let: { targetCustomerId: "$customerId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$targetCustomerId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$targetCustomerId" }] },
                    ],
                  },
                },
              },
            ],
            as: "customerData",
          },
        },
        {
          $addFields: {
            item: { $arrayElemAt: ["$itemData", 0] },
            customer: { $arrayElemAt: ["$customerData", 0] },
          },
        },
        {
          $addFields: {
            customerName: "$customer.name",
            customerEmail: "$customer.email",
          },
        },
        {
          $project: {
            itemData: 0,
            customerData: 0,
            "customer.password": 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    const transformed: OrderWithDetails[] = orders.map((o) =>
      toOrderResponse(o)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVendorOrderStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ status: OrderStatus }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { status } = req.body as { status: OrderStatus };

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    if (status !== "accepted" && status !== "rejected") {
      res.status(400).json({
        success: false,
        error: "Status must be either 'accepted' or 'rejected'",
      });
      return;
    }

    const orderObjectId = toObjectId(id);
    const vendorObjectId = toObjectId(req.user._id);
    const ordersCollection = getOrdersCollection();

    const order = await ordersCollection.findOne({
      _id: orderObjectId,
      vendorId: vendorObjectId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: "Order not found or you do not have permission to manage it",
      });
      return;
    }

    if (order.status !== "pending") {
      res.status(400).json({
        success: false,
        error:
          "Status cannot be modified. Only pending orders can be accepted or rejected once.",
      });
      return;
    }

    const now = new Date();
    await ordersCollection.updateOne(
      { _id: orderObjectId },
      {
        $set: { status },
        $push: { statusHistory: { status, at: now } },
      }
    );

    // Asynchronously trigger customer email notification
    (async () => {
      try {
        const usersCollection = getUsersCollection();
        const menuCollection = getMenuItemsCollection();

        const [customer, menuItem] = await Promise.all([
          usersCollection.findOne({
            $or: [{ _id: order.customerId }, { id: order.customerId.toString() }],
          }),
          menuCollection.findOne({ _id: order.itemId }),
        ]);

        if (customer?.email) {
          await sendOrderStatusNotificationEmail({
            customerEmail: customer.email,
            customerName: customer.name || "Pizza Lover",
            orderId: orderObjectId.toString(),
            pizzaName: menuItem?.itemName || "Artisanal Pizza",
            status,
            deliveryDate: order.deliveryDate,
            deliveryAddress: order.deliveryAddress,
            vendorName: req.user?.businessName || req.user?.name || "Artisan Kitchen",
          });
        }
      } catch (err) {
        console.error("[Email Notification Failed]", err);
      }
    })();

    res.status(200).json({
      success: true,
      data: { status },
      message: `Order ${status} successfully`,
    });
  } catch (error) {
    next(error);
  }
}
