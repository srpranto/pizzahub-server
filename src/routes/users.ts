import { Router } from "express";
import {
  getMe,
  updateMe,
  toggleFavorite,
  getAdminUsers,
  updateUserBlockStatus,
} from "../controllers/users.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.patch("/favorites/:itemId", requireAuth, requireRole("customer", "vendor"), toggleFavorite);
router.get("/admin/users", requireAuth, requireRole("admin"), getAdminUsers);
router.patch("/admin/users/:id/block", requireAuth, requireRole("admin"), updateUserBlockStatus);

export const adminUsersRouter = Router();
adminUsersRouter.get("/", requireAuth, requireRole("admin"), getAdminUsers);
adminUsersRouter.patch("/:id/block", requireAuth, requireRole("admin"), updateUserBlockStatus);

export default router;
