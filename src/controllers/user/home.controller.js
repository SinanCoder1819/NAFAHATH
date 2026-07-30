import CartModel from "../../models/Cart.model.js";
import User from "../../models/User.model.js";
import Wishlist from "../../models/Wishlist.model.js"; // Import the Wishlist model

export const getHomePage = (req, res) => {
  res.render("user/home");
};

export const setLocals = async (req, res, next) => {
  // Default values
  res.locals.wishlistCount = 0;
  res.locals.cartCount = 0;

  if (req.session.user) {
    try {
      // 1. Get wishlist count
      const wishlistDoc = await Wishlist.findOne({ userId: req.session.user.id }).select("products");
      if (wishlistDoc && wishlistDoc.products) {
        res.locals.wishlistCount = wishlistDoc.products.length;
      }
      
      // 2. Get cart count
      const cartDoc = await CartModel.findOne({ userId: req.session.user.id }).select("items");
      if (cartDoc && cartDoc.items) {
        res.locals.cartCount = cartDoc.items.length;
      }
    } catch (error) {
      console.error("Error setting locals:", error);
    }
  }

  next();
};