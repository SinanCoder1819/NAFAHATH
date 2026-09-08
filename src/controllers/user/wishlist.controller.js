import CartModel from "../../models/Cart.model.js";
import Product from "../../models/Product.model.js";
import Wishlist from "../../models/Wishlist.model.js"; 

const getUserId = (req, res) => {
    return (res && res.locals && res.locals.user && res.locals.user._id) ||
           (req.user && (req.user._id || req.user.id)) ||
           (req.session && req.session.user && (req.session.user._id || req.session.user.id));
};

// Render Wishlist Page
export const getWishlist = async (req, res) => {
    try {
        const userId = getUserId(req, res);

        // Fetch wishlist document instead of user document
        const wishlistDoc = await Wishlist.findOne({ userId })
            .populate({
                path: 'products',
                match: { isDeleted: false } // Only show active products
            })
            .lean();

        res.render("user/wishlist", { 
            wishlist: wishlistDoc ? wishlistDoc.products : []
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.redirect("/");
    }
};

// Add to Wishlist API
export const addToWishlist = async (req, res) => {
    try {
        const userId = getUserId(req, res);
        const productId = req.params.productId;

        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: "Product not found or unavailable." });
        }

        // Find or create wishlist for user
        let wishlistDoc = await Wishlist.findOne({ userId });
        if (!wishlistDoc) {
            wishlistDoc = new Wishlist({ userId, products: [] });
        }

        const isAlreadyInWishlist = wishlistDoc.products.some(p => {
            if (!p) return false;
            const idStr = p._id ? p._id.toString() : p.toString();
            return idStr === productId.toString();
        });

        if (isAlreadyInWishlist) {
            return res.status(200).json({ success: true, message: "Product is already in your wishlist!" });
        }

        wishlistDoc.products.push(productId);
        await wishlistDoc.save();

        res.status(200).json({ success: true, message: "Added to wishlist successfully!" });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Remove from Wishlist API
export const removeFromWishlist = async (req, res) => {
    try {
        const userId = getUserId(req, res);
        const productId = req.params.productId;

        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: productId } }
        );

        res.status(200).json({ success: true, message: "Removed from wishlist." });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


