import User from "../../models/User.model.js";

export const getHomePage = async (req, res) => {
    if (req.session?.user) {
        try {
            const userId = req.session.user.id || req.session.user._id;
            const user   = await User.findById(userId).select("isBlocked").lean();

            if (!user || user.isBlocked) {
                return req.session.destroy(() => {
                    res.redirect("/auth/login?blocked=true");
                });
            }
        } catch (err) {
            console.error("Home block check error:", err);
        }
    }

    res.render("user/home");
};
