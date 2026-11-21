import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getReviewsCollection, getMenuItemsCollection } from "../config/db.js";
import { isValidObjectId, toObjectId } from "../utils/validate.js";
import type {
  AuthenticatedRequest,
  ApiResponse,
  DbReview,
  ReviewResponse,
  ItemReviewsSummary,
} from "../types/index.js";

function toReviewResponse(doc: DbReview): ReviewResponse {
  return {
    id: doc._id.toString(),
    itemId: doc.itemId.toString(),
    vendorId: doc.vendorId.toString(),
    customerId: doc.customerId.toString(),
    customerName: doc.customerName,
    customerImage: doc.customerImage ?? null,
    rating: doc.rating,
    comment: doc.comment,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}

export async function getItemReviews(
  req: Request,
  res: Response<ApiResponse<ItemReviewsSummary>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    const itemObjectId = toObjectId(id);
    const reviewsCollection = getReviewsCollection();

    const rawReviews = await reviewsCollection
      .find({ itemId: itemObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    const totalReviews = rawReviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (rawReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10
          ) / 10
        : 0;

    const reviews = rawReviews.map(toReviewResponse);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        averageRating,
        totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function submitItemReview(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ review: ReviewResponse; summary: ItemReviewsSummary }>>,
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
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    const { rating, comment } = req.body as {
      rating?: number;
      comment?: string;
    };

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      res.status(400).json({
        success: false,
        error: "Rating must be an integer between 1 and 5 stars",
      });
      return;
    }

    if (!comment || typeof comment !== "string" || comment.trim().length < 3) {
      res.status(400).json({
        success: false,
        error: "Review comment must be at least 3 characters",
      });
      return;
    }

    if (comment.trim().length > 1000) {
      res.status(400).json({
        success: false,
        error: "Review comment cannot exceed 1000 characters",
      });
      return;
    }

    const itemObjectId = toObjectId(id);
    const menuCollection = getMenuItemsCollection();
    const menuItem = await menuCollection.findOne({ _id: itemObjectId });

    if (!menuItem || menuItem.status !== "approved") {
      res.status(404).json({
        success: false,
        error: "Menu item not found or is not approved for reviews",
      });
      return;
    }

    if (menuItem.vendorId.toString() === req.user._id) {
      res.status(403).json({
        success: false,
        error: "Vendors cannot write reviews for their own artisanal pizzas",
      });
      return;
    }

    const reviewsCollection = getReviewsCollection();
    const customerObjectId = toObjectId(req.user._id);
    const now = new Date();

    const existingReview = await reviewsCollection.findOne({
      itemId: itemObjectId,
      customerId: customerObjectId,
    });

    let savedReview: DbReview;

    if (existingReview) {
      await reviewsCollection.updateOne(
        { _id: existingReview._id },
        {
          $set: {
            rating: numRating,
            comment: comment.trim(),
            customerName: req.user.name,
            customerImage: req.user.image,
            updatedAt: now,
          },
        }
      );
      savedReview = {
        ...existingReview,
        rating: numRating,
        comment: comment.trim(),
        customerName: req.user.name,
        customerImage: req.user.image,
        updatedAt: now,
      };
    } else {
      const newReview: DbReview = {
        _id: new ObjectId(),
        itemId: itemObjectId,
        vendorId: menuItem.vendorId,
        customerId: customerObjectId,
        customerName: req.user.name,
        customerImage: req.user.image,
        rating: numRating,
        comment: comment.trim(),
        createdAt: now,
      };

      await reviewsCollection.insertOne(newReview);
      savedReview = newReview;
    }

    // Compute updated item rating summary
    const allReviews = await reviewsCollection
      .find({ itemId: itemObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10
          ) / 10
        : 0;

    res.status(200).json({
      success: true,
      data: {
        review: toReviewResponse(savedReview),
        summary: {
          reviews: allReviews.map(toReviewResponse),
          averageRating,
          totalReviews,
        },
      },
      message: existingReview
        ? "Review updated successfully!"
        : "Review submitted successfully!",
    });
  } catch (error) {
    next(error);
  }
}

export async function getVendorReviews(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<ReviewResponse[]>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const vendorObjectId = toObjectId(req.user._id);
    const reviewsCollection = getReviewsCollection();

    const reviews = await reviewsCollection
      .find({ vendorId: vendorObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: reviews.map(toReviewResponse),
    });
  } catch (error) {
    next(error);
  }
}
