import { Router } from "express";
import {
  getFeaturedMenuItems,
  getPublicMenuItems,
  getMenuItemById,
  getVendorMenuItems,
  createVendorMenuItem,
  updateVendorMenuItem,
  deleteVendorMenuItem,
  getAdminMenuItems,
  updateAdminMenuItemStatus,
  deleteAdminMenuItem,
} from "../controllers/menu.js";
import {
  getItemReviews,
  submitItemReview,
  getVendorReviews,
} from "../controllers/reviews.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/featured", getFeaturedMenuItems);
router.get("/:id/reviews", getItemReviews);
router.post("/:id/reviews", requireAuth, requireRole("customer", "vendor"), submitItemReview);
router.get("/", getPublicMenuItems);
router.get("/:id", requireAuth, getMenuItemById);

export const vendorMenuRouter = Router();
vendorMenuRouter.get("/reviews", requireAuth, requireRole("vendor"), getVendorReviews);
vendorMenuRouter.get("/", requireAuth, requireRole("vendor"), getVendorMenuItems);
vendorMenuRouter.post("/", requireAuth, requireRole("vendor"), createVendorMenuItem);
vendorMenuRouter.patch("/:id", requireAuth, requireRole("vendor"), updateVendorMenuItem);
vendorMenuRouter.delete("/:id", requireAuth, requireRole("vendor"), deleteVendorMenuItem);

export const adminMenuRouter = Router();
adminMenuRouter.get("/", requireAuth, requireRole("admin"), getAdminMenuItems);
adminMenuRouter.patch("/:id/status", requireAuth, requireRole("admin"), updateAdminMenuItemStatus);
adminMenuRouter.delete("/:id", requireAuth, requireRole("admin"), deleteAdminMenuItem);

export default router;
