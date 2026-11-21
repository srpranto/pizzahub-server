import { Router } from "express";
import {
  placeOrder,
  getCustomerOrders,
  cancelCustomerOrder,
  getVendorOrders,
  updateVendorOrderStatus,
} from "../controllers/orders.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.post("/", requireAuth, requireRole("customer", "vendor"), placeOrder);
router.get("/my", requireAuth, requireRole("customer", "vendor"), getCustomerOrders);
router.patch("/:id/cancel", requireAuth, requireRole("customer", "vendor"), cancelCustomerOrder);

export const vendorOrdersRouter = Router();
vendorOrdersRouter.get("/", requireAuth, requireRole("vendor"), getVendorOrders);
vendorOrdersRouter.patch("/:id/status", requireAuth, requireRole("vendor"), updateVendorOrderStatus);

export default router;
