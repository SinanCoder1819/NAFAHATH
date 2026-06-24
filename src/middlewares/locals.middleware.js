import User from "../models/User.model.js";


export const setLocalsMiddleware = async (req, res, next) => {
    try {
        const isAdminRoute = req.path.startsWith("/admin");

        if (isAdminRoute) {
            res.locals.admin = req.session?.admin || null;
            res.locals.user  = null;
        } else {
            res.locals.admin = null;

            if (req.session?.user) {
                const userId = req.session.user.id || req.session.user._id;
                const dbUser = await User.findById(userId)
                    .select("name email profileImage isBlocked")
                    .lean();
                
                
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
