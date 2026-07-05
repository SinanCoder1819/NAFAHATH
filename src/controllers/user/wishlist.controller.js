import User from "../../models/User.model.js";
import Product from "../../models/Product.model.js";

// Render Wishlist Page
export const getWishlist = async (req, res) => {
    try {
        const userId = (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));

        // Populate the wishlist with product data
        const user = await User.findById(userId)
            .populate({
                path: 'wishlist',
                match: { isDeleted: false } // Only show active products
            })
            .lean();

        res.render("user/wishlist", { 
            wishlist: user.wishlist || []
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.redirect("/");
    }
};

// Add to Wishlist API
export const addToWishlist = async (req, res) => {
    try {
        const userId = (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));
        const productId = req.params.productId;

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: "Product not found or unavailable." });
        }

        const user = await User.findById(userId);

        // Check if already in wishlist
        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ success: true, message: "Product is already in your wishlist!" });
        }

        user.wishlist.push(productId);
        await user.save();

        res.status(200).json({ success: true, message: "Added to wishlist successfully!" });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Remove from Wishlist API
export const removeFromWishlist = async (req, res) => {
    try {
        const userId = (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));
        const productId = req.params.productId;

        await User.findByIdAndUpdate(userId, {
            $pull: { wishlist: productId }
        });

        res.status(200).json({ success: true, message: "Removed from wishlist." });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};
