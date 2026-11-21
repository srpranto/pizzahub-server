import type { Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../config/db.js";
import { toObjectId, isValidObjectId } from "../utils/validate.js";
import type { AuthenticatedRequest, ApiResponse, DbUser } from "../types/index.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<AuthenticatedRequest["user"]>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const users = getUsersCollection();
    let query: Record<string, unknown>;

    if (ObjectId.isValid(req.user._id)) {
      query = {
        $or: [{ _id: new ObjectId(req.user._id) }, { id: req.user._id }],
      };
    } else {
      query = { id: req.user._id };
    }

    const liveUser = await users.findOne(query);

    if (!liveUser) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        _id: liveUser._id.toString(),
        id: liveUser._id.toString(),
        name: liveUser.name,
        email: liveUser.email,
        role: liveUser.role,
        isBlocked: liveUser.isBlocked,
        businessName: liveUser.businessName ?? null,
        subscriptionPlan: liveUser.subscriptionPlan,
        subscriptionExpiresAt: liveUser.subscriptionExpiresAt,
        favoriteItemIds: liveUser.favoriteItemIds ?? [],
        image: liveUser.image ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMe(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<DbUser>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { name, image, businessName } = req.body as {
      name?: string;
      image?: string;
      businessName?: string;
    };

    const updateFields: Partial<DbUser> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (typeof name === "string" && name.trim().length >= 2) {
      updateFields.name = name.trim();
    }

    if (typeof image === "string") {
      updateFields.image = image.trim();
    }

    if (typeof businessName === "string") {
      updateFields.businessName = businessName.trim();
    }

    const users = getUsersCollection();
    let query: Record<string, unknown>;

    if (ObjectId.isValid(req.user._id)) {
      query = {
        $or: [{ _id: new ObjectId(req.user._id) }, { id: req.user._id }],
      };
    } else {
      query = { id: req.user._id };
    }

    await users.updateOne(query, { $set: updateFields });
    const updated = await users.findOne(query);

    if (!updated) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleFavorite(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ favoriteItemIds: string[] }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const rawItemId = req.params.itemId;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

    if (!itemId) {
      res.status(400).json({ success: false, error: "Item ID required" });
      return;
    }

    const users = getUsersCollection();
    let query: Record<string, unknown>;

    if (ObjectId.isValid(req.user._id)) {
      query = {
        $or: [{ _id: new ObjectId(req.user._id) }, { id: req.user._id }],
      };
    } else {
      query = { id: req.user._id };
    }

    const user = await users.findOne(query);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const currentFavorites = user.favoriteItemIds ?? [];
    let updatedFavorites: string[];

    if (currentFavorites.includes(itemId)) {
      updatedFavorites = currentFavorites.filter((id) => id !== itemId);
    } else {
      updatedFavorites = [...currentFavorites, itemId];
    }

    await users.updateOne(query, {
      $set: { favoriteItemIds: updatedFavorites, updatedAt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: { favoriteItemIds: updatedFavorites },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<DbUser[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const rawSearch = req.query.search;
    const rawRole = req.query.role;
    const search = typeof rawSearch === "string" ? rawSearch : undefined;
    const role = typeof rawRole === "string" ? rawRole : undefined;

    const query: Record<string, unknown> = {};

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [{ name: regex }, { email: regex }];
    }

    if (role && (role === "customer" || role === "vendor" || role === "admin")) {
      query.role = role;
    }

    const users = getUsersCollection();
    const result = await users.find(query).sort({ createdAt: -1 }).toArray();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserBlockStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<{ isBlocked: boolean }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { isBlocked } = req.body as { isBlocked: boolean };

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({ success: false, error: "Valid user ID required" });
      return;
    }

    if (typeof isBlocked !== "boolean") {
      res.status(400).json({ success: false, error: "isBlocked boolean is required" });
      return;
    }

    if (id === req.user._id || id === req.user.id) {
      res.status(400).json({
        success: false,
        error: "Admins cannot block or unblock their own account",
      });
      return;
    }

    const users = getUsersCollection();
    const targetUserId = toObjectId(id);

    const updateResult = await users.updateOne(
      { _id: targetUserId },
      { $set: { isBlocked, updatedAt: new Date() } }
    );

    if (updateResult.matchedCount === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: { isBlocked },
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
    });
  } catch (error) {
    next(error);
  }
}
