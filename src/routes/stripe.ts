import { Router } from "express";
import {
  createCheckoutSession,
  getAdminTransactions,
} from "../controllers/stripe.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.post("/checkout", requireAuth, requireRole("vendor"), createCheckoutSession);
router.get("/admin/transactions", requireAuth, requireRole("admin"), getAdminTransactions);

export const adminTransactionsRouter = Router();
adminTransactionsRouter.get("/", requireAuth, requireRole("admin"), getAdminTransactions);

export default router;
