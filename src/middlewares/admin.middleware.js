import User from "../models/User.model.js";

/**
 * Protect admin routes.
 * 1. Checks req.session.admin exists and has role === "admin"
 * 2. Validates the admin user still exists in DB and is not blocked
 * 3. Refreshes req.session.admin with latest DB data
 */
export const isAdmin = async (req, res, next) => {
    const session = req.session;

    // No admin session at all
    if (!session || !session.admin || session.admin.role !== "admin") {
        return _unauthorized(req, res);
    }

    try {
        // Live DB check — catches: deleted admin, role downgraded, account blocked
        const admin = await User.findById(session.admin.id)
            .select("name email role isBlocked")
            .lean();

        if (!admin || admin.role !== "admin" || admin.isBlocked) {
            // Invalidate the session
            return session.destroy(() => _unauthorized(req, res));
        }

        // Keep session data fresh
        session.admin = {
            id:    admin._id.toString(),
            name:  admin.name,
            email: admin.email,
            role:  admin.role,
        };

        // Make available in views (layout uses res.locals.admin)
        res.locals.admin = session.admin;

        return next();
    } catch (err) {
        console.error("isAdmin middleware error:", err);
        return _unauthorized(req, res);
    }
};

function _unauthorized(req, res) {
    const isAjax = req.xhr
        || req.headers.accept?.includes("application/json")
        || req.headers["content-type"]?.includes("application/json");

    if (isAjax) {
        return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    return res.redirect("/admin/login");
}
