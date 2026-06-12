import User from "../models/User.model.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Global locals middleware
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Makes res.locals.user (or .admin) available in every EJS template.
// IMPORTANT: fetches a fresh copy from DB on every request so the navbar
// immediately reflects block/unblock without a server restart.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const setLocalsMiddleware = async (req, res, next) => {
    try {
        const isAdminRoute = req.path.startsWith("/admin");

        if (isAdminRoute) {
            // Admin routes: expose admin session, never expose user
            res.locals.admin = req.session?.admin || null;
            res.locals.user  = null;
        } else {
            res.locals.admin = null;

            if (req.session?.user) {
                const userId = req.session.user.id || req.session.user._id;
                const dbUser = await User.findById(userId)
                    .select("name email profileImage isBlocked")
                    .lean();

                // If the user was blocked or deleted, clear session and redirect
                if (!dbUser || dbUser.isBlocked) {
                    res.locals.user = null;
                    return req.session.destroy(() => {
                        res.clearCookie("user.sid");
                        res.redirect("/auth/login?blocked=true");
                    });
                } else {
                    res.locals.user = dbUser;
                }
            } else {
                // No session — guest visitor
                res.locals.user = null;
            }
        }
    } catch (err) {
        console.error("Locals middleware error:", err);
        res.locals.user  = null;
        res.locals.admin = null;
    }
    next();
};
