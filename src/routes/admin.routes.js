import express from "express";
import { getAdminLogin, postAdminLogin, getAdminLogout } from "../controllers/admin/auth.controller.js";
import { isAdmin } from "../middlewares/admin.middleware.js";
import { isAdminLogout, noCache } from "../middlewares/auth.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import { getCustomers, toggleBlockUser } from "../controllers/admin/customers.controller.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH (public-ish)
//   isAdminLogout → if admin is already logged in, redirect to /admin/dashboard
//   noCache       → back button after admin logout must NOT show a cached login page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/login",  isAdminLogout, noCache, getAdminLogin);
router.post("/login", postAdminLogin);
router.get("/logout", getAdminLogout);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROTECTED
//   isAdmin → applied once via router.use(); covers all routes below.
//             It also sets no-cache headers internally for all admin pages.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.use(isAdmin);

router.get("/dashboard",             getDashboard);
router.get("/customers",             getCustomers);
router.patch("/customers/:id/block", toggleBlockUser);

export default router;
