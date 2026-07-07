import CartModel from "../../models/Cart.model.js";
import User from "../../models/User.model.js";

export const getHomePage = (req, res) => {
  res.render("user/home");
};

export const setLocals = async (req, res, next) => {
  res.locals.wishlistCount = 0;

  if (req.session.user) {
    const user = await User.findById(req.session.user.id).select("wishlist");
    
    const cartCount = await CartModel.findOne({
      userId: req.session.user.id,
    }).select("items");

    if (user) {
      res.locals.wishlistCount = user.wishlist.length;
      res.locals.cartCount = cartCount.items.length;
    }
  }

  console.log("setLocals", res.locals);

  next();
};
