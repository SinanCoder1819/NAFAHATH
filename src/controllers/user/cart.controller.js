import Cart from "../../models/Cart.model.js";
import Product from "../../models/Product.model.js";
import User from "../../models/User.model.js";

// Helper function to safely get user ID
const getUserId = (req) => {
    return (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));
};

// Render Cart Page
export const getCart = async (req, res) => {
    try {
        const userId = getUserId(req);

        let cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            match: { isDeleted: false }
        });

        if (!cart) {
            cart = { items: [], cartTotal: 0 };
        } else {
            // Filter out items where the product was deleted
            cart.items = cart.items.filter(item => item.productId !== null);
            await cart.save();
        }

        res.render("user/cart", { cart });
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.redirect("/");
    }
};

// Add to Cart
export const addToCart = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { productId, variantId, quantity = 1 } = req.body;

        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: "Product not available" });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({ success: false, message: "Selected variant not found" });
        }

        if (variant.stock < quantity) {
            return res.status(400).json({ success: false, message: "Not enough stock available" });
        }

        const price = variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [], cartTotal: 0 });
        }

        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId && item.variantId.toString() === variantId
        );

        if (existingItemIndex > -1) {
            // Check max stock if adding more
            const newQty = cart.items[existingItemIndex].quantity + parseInt(quantity);
            if (newQty > variant.stock) {
                return res.status(400).json({ success: false, message: `Only ${variant.stock} items left in stock!` });
            }
            if (newQty > 5) {
                return res.status(400).json({ success: false, message: "Maximum 5 units per order allowed" });
            }
            cart.items[existingItemIndex].quantity = newQty;
            cart.items[existingItemIndex].totalPrice = newQty * price;
        } else {
            if (quantity > 5) {
                return res.status(400).json({ success: false, message: "Maximum 5 units per order allowed" });
            }
            cart.items.push({
                productId,
                variantId,
                quantity: parseInt(quantity),
                price,
                totalPrice: parseInt(quantity) * price
            });
        }

        await cart.save();
        
        // Remove from wishlist if it exists
        await User.findByIdAndUpdate(userId, {
            $pull: { wishlist: productId }
        });

        res.status(200).json({ success: true, message: "Added to cart successfully!" });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Update Cart Quantity
export const updateCartQuantity = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { productId, variantId, action } = req.body; // action = 'increment' or 'decrement'

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        const itemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId && item.variantId.toString() === variantId
        );

        if (itemIndex === -1) return res.status(404).json({ success: false, message: "Item not found in cart" });

        const product = await Product.findById(productId);
        const variant = product.variants.id(variantId);
        
        let currentQty = cart.items[itemIndex].quantity;
        
        if (action === 'increment') {
            if (currentQty >= variant.stock) return res.status(400).json({ success: false, message: "Out of stock" });
            if (currentQty >= 5) return res.status(400).json({ success: false, message: "Maximum limit reached" });
            currentQty += 1;
        } else if (action === 'decrement') {
            if (currentQty <= 1) return res.status(400).json({ success: false, message: "Minimum 1 required" });
            currentQty -= 1;
        }

        cart.items[itemIndex].quantity = currentQty;
        cart.items[itemIndex].totalPrice = currentQty * cart.items[itemIndex].price;

        await cart.save();
        
        res.status(200).json({ 
            success: true, 
            itemTotal: cart.items[itemIndex].totalPrice,
            cartTotal: cart.cartTotal
        });

    } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Remove from Cart
export const removeFromCart = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { productId, variantId } = req.body;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        cart.items = cart.items.filter(
            (item) => !(item.productId.toString() === productId && item.variantId.toString() === variantId)
        );

        await cart.save();
        res.status(200).json({ success: true, cartTotal: cart.cartTotal });

    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
