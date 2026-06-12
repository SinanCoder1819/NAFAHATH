import User from "../models/User.model.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// isAdmin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Protects all admin routes that require an active admin session.
//
// What it does:
//   1. Checks req.session.admin exists with role === "admin"
//   2. Does a LIVE DB lookup on every request
//        → catches role changes, blocks, or deletions after login
//   3. Refreshes res.locals.admin so EJS templates always have fresh data
//   4. Only calls next() when the admin session is valid and the admin is active
//
// Where to use:
//   router.use(isAdmin)   ← applied once before all protected admin routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const isAdmin = async (req, res, next) => {
  const session = req.session;

  // ── Step 1: Does an admin session exist? ────────────────────────────────────
  if (!session?.admin || session.admin.role !== "admin") {
    return _unauthorized(req, res);
  }

  // ── Step 2: Live DB check ────────────────────────────────────────────────────
  try {
    const admin = await User.findById(session.admin.id)
      .select("name email role isBlocked")
      .lean();

    if (!admin || admin.role !== "admin" || admin.isBlocked) {
      // Admin was demoted, deleted, or blocked while the session was alive
      return session.destroy(() => {
        res.clearCookie("admin.sid");
        return _unauthorized(req, res);
      });
    }

    // ── Step 3: Keep session data fresh ──────────────────────────────────────
    // Update session with latest DB values (e.g., if admin name was changed)
    session.admin = {
      id:    admin._id.toString(),
      name:  admin.name,
      email: admin.email,
      role:  admin.role,
    };

    // Make admin data available in all EJS admin templates
    res.locals.admin = session.admin;

    // ── Step 4: Set no-cache headers for all admin pages ─────────────────────
    // Admin pages should NEVER be served from cache (bfcache / back button)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma",        "no-cache");
    res.setHeader("Expires",       "0");

    return next();
  } catch (err) {
    console.error("isAdmin middleware error:", err);
    return _unauthorized(req, res);
  }
};

// ── Private helper ─────────────────────────────────────────────────────────────
// Decides whether to send a JSON error (AJAX) or a redirect (normal page request)
function _unauthorized(req, res) {
  const isAjax =
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.headers["content-type"]?.includes("application/json");

  if (isAjax) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
  return res.redirect("/admin/login");
}
