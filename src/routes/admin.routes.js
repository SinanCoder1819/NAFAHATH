import express from "express";
import { getAdminLogin, postAdminLogin, getAdminLogout } from "../controllers/admin/auth.controller.js";
import { isAdmin } from "../middlewares/admin.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import { getCustomers, toggleBlockUser } from "../controllers/admin/customers.controller.js";

const router = express.Router();

// ── Auth (public) ─────────────────────────────────────
router.get("/login", getAdminLogin);
router.post("/login", postAdminLogin);
router.get("/logout", getAdminLogout);

// ── Protected ─────────────────────────────────────────
router.use(isAdmin);

router.get("/dashboard", getDashboard);
router.get("/customers", getCustomers);
router.patch("/customers/:id/block", toggleBlockUser);

export default router;
