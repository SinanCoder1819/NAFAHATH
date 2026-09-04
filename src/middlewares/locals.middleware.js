import User from "../models/User.model.js";
import Cart from "../models/Cart.model.js";
import Wishlist from "../models/Wishlist.model.js";

export const setLocalsMiddleware = async (req, res, next) => {
    try {
        const isAdminRoute = req.path.startsWith("/admin");

        if (isAdminRoute) {
            res.locals.admin = req.session?.admin || null;
            res.locals.user  = null;
        } else {
            res.locals.admin = null;
            res.locals.cartCount = 0;
            res.locals.wishlistCount = 0;
            res.locals.wishlistProductIds = [];

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

                    const [userCart, userWishlist] = await Promise.all([
                        Cart.findOne({ userId: dbUser._id }).lean(),
                        Wishlist.findOne({ userId: dbUser._id })
                            .populate({
                                path: 'products',
                                select: '_id',
                                match: { isDeleted: false }
                            })
                            .lean()
                    ]);

                    res.locals.cartCount = userCart && userCart.items ? userCart.items.length : 0;
                    res.locals.wishlistCount = userWishlist && userWishlist.products ? userWishlist.products.length : 0;
                    res.locals.wishlistProductIds = (userWishlist && userWishlist.products)
                        ? userWishlist.products.map(p => (p && p._id ? p._id.toString() : p ? p.toString() : '')).filter(Boolean)
                        : [];
                }
            } else {
                res.locals.user = null;
            }
        }
    } catch (err) {
        console.error("Locals middleware error:", err);
        res.locals.user  = null;
        res.locals.admin = null;
        res.locals.wishlistProductIds = [];
    }
    next();
};
