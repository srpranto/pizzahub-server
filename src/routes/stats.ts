import { Router } from "express";
import {
  getCustomerStats,
  getVendorStats,
  getAdminStats,
} from "../controllers/stats.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/customer", requireAuth, requireRole("customer"), getCustomerStats);
router.get("/vendor", requireAuth, requireRole("vendor"), getVendorStats);
router.get("/admin", requireAuth, requireRole("admin"), getAdminStats);

export default router;
