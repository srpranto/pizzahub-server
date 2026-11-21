import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import type { Response, NextFunction } from "express";
import { getUsersCollection } from "../config/db.js";
import type { AuthenticatedRequest, ApiResponse } from "../types/index.js";

const jwksUrl =
  process.env.BETTER_AUTH_JWKS_URL || "http://localhost:3000/api/auth/jwks";
const secret =
  process.env.BETTER_AUTH_SECRET ||
  "default_pizzahub_better_auth_secret_key_1234567890";

const remoteJWKS = createRemoteJWKSet(new URL(jwksUrl));

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<null>>,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authorization token required",
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      error: "Authorization token required",
    });
    return;
  }

  let sub: string | undefined;

  try {
    const verified = await jwtVerify(token, remoteJWKS);
    sub = verified.payload.sub;
  } catch {
    try {
      const verified = await jwtVerify(
        token,
        new TextEncoder().encode(secret)
      );
      sub = verified.payload.sub;
    } catch {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
      return;
    }
  }

  if (!sub) {
    res.status(401).json({
      success: false,
      error: "Invalid token payload: missing subject identifier",
    });
    return;
  }

  try {
    const usersCollection = getUsersCollection();
    let query: Record<string, unknown>;

    if (ObjectId.isValid(sub)) {
      query = {
        $or: [{ _id: new ObjectId(sub) }, { id: sub }],
      };
    } else {
      query = { id: sub };
    }

    const dbUser = await usersCollection.findOne(query);

    if (!dbUser) {
      res.status(401).json({
        success: false,
        error: "User not found or account no longer active",
      });
      return;
    }

    if (dbUser.isBlocked) {
      res.status(403).json({
        success: false,
        error: "Your account has been suspended. Please contact support.",
      });
      return;
    }

    req.user = {
      _id: dbUser._id.toString(),
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      isBlocked: dbUser.isBlocked,
      businessName: dbUser.businessName ?? null,
      subscriptionPlan: dbUser.subscriptionPlan,
      subscriptionExpiresAt: dbUser.subscriptionExpiresAt,
      favoriteItemIds: dbUser.favoriteItemIds ?? [],
      image: dbUser.image ?? null,
    };

    next();
  } catch (error) {
    next(error);
  }
}
