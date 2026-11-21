import type { Request, Response, NextFunction } from "express";
import { getMenuItemsCollection } from "../config/db.js";
import { CATEGORIES } from "../config/constants.js";
import { isValidObjectId, toObjectId, toMenuItemResponse } from "../utils/validate.js";
import type {
  AuthenticatedRequest,
  ApiResponse,
  DbMenuItem,
  MenuItemCategory,
  MenuItemStatus,
  MenuItemWithVendor,
} from "../types/index.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function getFeaturedMenuItems(
  req: Request,
  res: Response<ApiResponse<MenuItemWithVendor[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const menuCollection = getMenuItemsCollection();
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 4, 1),
      50
    );

    const pizzaCategories = [
      "Classic Pizzas",
      "Vegetarian Pizzas",
      "Meat Lovers",
      "Specialty / Gourmet Pizzas",
    ];

    const featuredItems = await menuCollection
      .aggregate([
        {
          $match: {
            status: "approved",
            category: { $in: pizzaCategories },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { vId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$vId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$vId" }] },
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
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $addFields: {
            isPremiumVendor: {
              $cond: [
                { $eq: ["$vendor.subscriptionPlan", "premium"] },
                1,
                0,
              ],
            },
            vendorName: {
              $ifNull: ["$vendor.businessName", "$vendor.name"],
            },
            vendorPlan: {
              $ifNull: ["$vendor.subscriptionPlan", "free"],
            },
          },
        },
        {
          $project: {
            vendorData: 0,
            "vendor.password": 0,
          },
        },
        {
          $sort: {
            isPremiumVendor: -1,
            createdAt: -1,
          },
        },
        {
          $limit: limit,
        },
      ])
      .toArray();

    const transformed = featuredItems.map((item) =>
      toMenuItemResponse(item as Record<string, unknown>)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicMenuItems(
  req: Request,
  res: Response<ApiResponse<MenuItemWithVendor[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawSearch = req.query.search;
    const rawCategory = req.query.category;
    const rawLocation = req.query.location;
    const rawSort = req.query.sort;
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;

    const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
    const category = typeof rawCategory === "string" ? rawCategory.trim() : "";
    const location = typeof rawLocation === "string" ? rawLocation.trim() : "";
    const sort = typeof rawSort === "string" ? rawSort : "newest";
    const page = typeof rawPage === "string" ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;
    const limit = typeof rawLimit === "string" ? Math.max(1, Math.min(50, parseInt(rawLimit, 10) || 12)) : 12;
    const skip = (page - 1) * limit;

    const matchQuery: Record<string, unknown> = {
      status: "approved",
    };

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      matchQuery.$or = [
        { itemName: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ];
    }

    if (category && category !== "All") {
      matchQuery.category = category;
    }

    if (location && location !== "All") {
      matchQuery.location = new RegExp(escapeRegex(location), "i");
    }

    const sortOption: Record<string, 1 | -1> = {};
    if (sort === "price_asc") {
      sortOption.price = 1;
    } else if (sort === "price_desc") {
      sortOption.price = -1;
    } else {
      sortOption.createdAt = -1;
    }

    const menuCollection = getMenuItemsCollection();
    const total = await menuCollection.countDocuments(matchQuery);

    const items = await menuCollection
      .aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            let: { vId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$vId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$vId" }] },
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
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $addFields: {
            vendorName: {
              $ifNull: ["$vendor.businessName", "$vendor.name"],
            },
            vendorPlan: {
              $ifNull: ["$vendor.subscriptionPlan", "free"],
            },
          },
        },
        {
          $project: {
            vendorData: 0,
            "vendor.password": 0,
          },
        },
        { $sort: sortOption },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();

    const transformed = items.map((item) =>
      toMenuItemResponse(item as Record<string, unknown>)
    );

    res.status(200).json({
      success: true,
      data: transformed,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItemById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<MenuItemWithVendor>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const objectId = toObjectId(id);

    const items = await menuCollection
      .aggregate([
        { $match: { _id: objectId } },
        {
          $lookup: {
            from: "users",
            let: { vId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$vId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$vId" }] },
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
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $addFields: {
            vendorName: {
              $ifNull: ["$vendor.businessName", "$vendor.name"],
            },
            vendorPlan: {
              $ifNull: ["$vendor.subscriptionPlan", "free"],
            },
          },
        },
        {
          $project: {
            vendorData: 0,
            "vendor.password": 0,
          },
        },
      ])
      .toArray();

    const item = items[0];
    if (!item) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    const isOwner = req.user && req.user._id === item.vendorId.toString();
    const isAdmin = req.user && req.user.role === "admin";

    if (item.status !== "approved" && !isOwner && !isAdmin) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: toMenuItemResponse(item as Record<string, unknown>),
    });
  } catch (error) {
    next(error);
  }
}

export async function getVendorMenuItems(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<MenuItemWithVendor[]>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const vendorObjectId = toObjectId(req.user._id);

    const items = await menuCollection
      .find({ vendorId: vendorObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    const transformed = items.map((item) =>
      toMenuItemResponse(item as Record<string, unknown>)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}

export async function createVendorMenuItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<MenuItemWithVendor>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { itemName, category, description, price, location, images } =
      req.body as {
        itemName?: string;
        category?: MenuItemCategory;
        description?: string;
        price?: number;
        location?: string;
        images?: string[];
      };

    if (
      !itemName ||
      !category ||
      !CATEGORIES.includes(category) ||
      !description ||
      typeof price !== "number" ||
      price <= 0 ||
      !location ||
      !Array.isArray(images) ||
      images.length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "All fields are required and must be valid. Category must be one of the 6 fixed categories.",
      });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const vendorObjectId = toObjectId(req.user._id);

    const activeItemCount = await menuCollection.countDocuments({
      vendorId: vendorObjectId,
      status: { $in: ["pending", "approved"] },
    });

    const plan = req.user.subscriptionPlan ?? "free";
    if (plan !== "premium" && activeItemCount >= 3) {
      res.status(403).json({
        success: false,
        error:
          "Free plan limit reached (max 3 active items). Upgrade to Premium to publish more menu items.",
      });
      return;
    }

    const newItem: Omit<DbMenuItem, "_id"> = {
      vendorId: vendorObjectId,
      itemName: itemName.trim(),
      category,
      description: description.trim(),
      price,
      location: location.trim(),
      images,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await menuCollection.insertOne(newItem as DbMenuItem);

    res.status(201).json({
      success: true,
      data: toMenuItemResponse({
        ...newItem,
        _id: result.insertedId,
      }),
      message: "Menu item submitted for approval",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVendorMenuItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<MenuItemWithVendor | null>>,
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

    const menuCollection = getMenuItemsCollection();
    const itemObjectId = toObjectId(id);
    const vendorObjectId = toObjectId(req.user._id);

    const existing = await menuCollection.findOne({
      _id: itemObjectId,
      vendorId: vendorObjectId,
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: "Menu item not found or you do not have permission to edit it",
      });
      return;
    }

    const {
      itemName,
      category,
      description,
      price,
      location,
      images,
      status,
    } = req.body as {
      itemName?: string;
      category?: MenuItemCategory;
      description?: string;
      price?: number;
      location?: string;
      images?: string[];
      status?: MenuItemStatus;
    };

    if (category && !CATEGORIES.includes(category)) {
      res.status(400).json({
        success: false,
        error: "Category must be one of the 6 fixed categories",
      });
      return;
    }

    if (status) {
      if (status === "approved") {
        if (existing.status !== "approved" && existing.status !== "inactive") {
          res.status(403).json({
            success: false,
            error: "Vendors cannot self-approve pending or rejected menu items",
          });
          return;
        }
      } else if (status !== "inactive" && status !== "pending") {
        res.status(400).json({
          success: false,
          error: "Invalid status value for vendor item update",
        });
        return;
      }
    }

    const plan = req.user.subscriptionPlan ?? "free";
    if (
      status &&
      (status === "approved" || status === "pending") &&
      existing.status === "inactive"
    ) {
      const activeItemCount = await menuCollection.countDocuments({
        vendorId: vendorObjectId,
        status: { $in: ["pending", "approved"] },
        _id: { $ne: itemObjectId },
      });

      if (plan !== "premium" && activeItemCount >= 3) {
        res.status(403).json({
          success: false,
          error:
            "Cannot reactivate item. Free plan permits at most 3 active items.",
        });
        return;
      }
    }

    const updateFields: Partial<DbMenuItem> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (itemName && itemName.trim()) updateFields.itemName = itemName.trim();
    if (category) updateFields.category = category;
    if (description && description.trim()) updateFields.description = description.trim();
    if (typeof price === "number" && price > 0) updateFields.price = price;
    if (location && location.trim()) updateFields.location = location.trim();
    if (Array.isArray(images) && images.length > 0) updateFields.images = images;
    if (status && (status === "inactive" || status === "pending" || status === "approved")) {
      updateFields.status = status;
    }

    await menuCollection.updateOne(
      { _id: itemObjectId },
      { $set: updateFields }
    );

    const updated = await menuCollection.findOne({ _id: itemObjectId });

    res.status(200).json({
      success: true,
      data: updated
        ? toMenuItemResponse(updated as Record<string, unknown>)
        : null,
      message: "Menu item updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteVendorMenuItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<null>>,
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

    const menuCollection = getMenuItemsCollection();
    const itemObjectId = toObjectId(id);
    const vendorObjectId = toObjectId(req.user._id);

    const result = await menuCollection.deleteOne({
      _id: itemObjectId,
      vendorId: vendorObjectId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        error: "Menu item not found or you do not have permission to delete it",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminMenuItems(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<MenuItemWithVendor[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawSearch = req.query.search;
    const rawStatus = req.query.status;
    const rawCategory = req.query.category;

    const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
    const status = typeof rawStatus === "string" ? rawStatus.trim() : "";
    const category = typeof rawCategory === "string" ? rawCategory.trim() : "";

    const query: Record<string, unknown> = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      query.$or = [{ itemName: searchRegex }, { location: searchRegex }];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    const menuCollection = getMenuItemsCollection();

    const items = await menuCollection
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: "users",
            let: { vId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$vId"] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$vId" }] },
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

    const transformed = items.map((item) =>
      toMenuItemResponse(item as Record<string, unknown>)
    );

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminMenuItemStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ status: MenuItemStatus }>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { status } = req.body as { status: MenuItemStatus };

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    if (!status || !["pending", "approved", "rejected", "inactive"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Valid status required (pending, approved, rejected, inactive)",
      });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const itemObjectId = toObjectId(id);

    const updateResult = await menuCollection.updateOne(
      { _id: itemObjectId },
      { $set: { status, updatedAt: new Date() } }
    );

    if (updateResult.matchedCount === 0) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: { status },
      message: `Menu item status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminMenuItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<null>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    const menuCollection = getMenuItemsCollection();
    const itemObjectId = toObjectId(id);

    const result = await menuCollection.deleteOne({ _id: itemObjectId });

    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: "Menu item not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Menu item removed by admin",
    });
  } catch (error) {
    next(error);
  }
}
