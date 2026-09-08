import Product from "../../models/Product.model.js";
import Category from "../../models/Category.model.js";
import CartModel from "../../models/Cart.model.js";
import Wishlist from "../../models/Wishlist.model.js";

export const getHomePage = async (req, res) => {
  try {
    // 1. Get active categories
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

    // 2. Get New Arrivals (latest 4 active products)
    const newArrivals = await Product.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // 3. Get Best Sellers (active products)
    let bestSellers = await Product.find({ isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(4)
      .lean();

    if (!bestSellers || bestSellers.length === 0) {
      bestSellers = newArrivals;
    }

    res.render("user/home", {
      categories: categories || [],
      newArrivals: newArrivals || [],
      bestSellers: bestSellers || []
    });
  } catch (error) {
    console.error("Error loading dynamic home page:", error);
    res.render("user/home", {
      categories: [],
      newArrivals: [],
      bestSellers: []
    });
  }
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