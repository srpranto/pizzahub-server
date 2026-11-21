import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest, ApiResponse, UserRole } from "../types/index.js";

export function requireRole(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "Forbidden: insufficient permissions for this resource",
      });
      return;
    }

    next();
  };
}
