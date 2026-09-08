import express from "express";
import * as profileController from "../controllers/user/profile.controller.js";
import * as addressController from "../controllers/user/address.controller.js";
import { getHomePage } from "../controllers/user/home.controller.js";
import { upload } from "../config/cloudinary.js";
import { isLogin, noCache } from "../middlewares/auth.middleware.js";
import {
  getProductsDetail,
  getShopPage,
} from "../controllers/user/product.controller.js";
import * as wishlistController from "../controllers/user/wishlist.controller.js";
import * as cartController from "../controllers/user/cart.controller.js";
import * as checkoutController from "../controllers/user/checkout.controller.js";
import * as orderController from "../controllers/user/order.controller.js";

const router = express.Router();

const handleUpload = (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image must be under 2MB." });
      }
      console.error("Multer/Cloudinary error:", err);
      return res
        .status(400)
        .json({ message: err.message || "File upload failed." });
    }
    next();
  });
};

router.use((req, res, next) => {
  // console.log(res.locals);
  next();
});

router.get("/", getHomePage);

router.get("/profile", isLogin, noCache, profileController.getProfile);
router.get("/profile/edit", isLogin, noCache, profileController.getEditProfile);
router.post("/profile/edit", isLogin, profileController.updateProfile);

router.post("/profile/update-image", isLogin, handleUpload, profileController.uploadProfileImage);

router.get("/profile/change-password", isLogin, noCache, profileController.blockGoogleUser, profileController.getChangePassword);
router.post("/profile/change-password", isLogin, profileController.changePassword);

router.get("/profile/change-email", isLogin, noCache, profileController.blockGoogleUser, profileController.getChangeEmail);
router.post("/profile/change-email/send-otp", isLogin, profileController.sendChangeEmailOtp);
router.get("/profile/change-email/verify-otp", isLogin, noCache, profileController.getVerifyEmailOtp);
router.post("/profile/change-email/verify-otp", isLogin, profileController.verifyChangeEmailOtp);
router.post("/profile/change-email/resend-otp", isLogin, profileController.resendChangeEmailOtp);

router.get("/address", isLogin, noCache, addressController.getAddressPage);
router.post("/address", isLogin, addressController.addAddress);
router.put("/address/:id", isLogin, addressController.editAddress);
router.delete("/address/:id", isLogin, addressController.deleteAddress);
router.patch("/address/:id/set-default", isLogin, addressController.setDefaultAddress);

router.get("/referrals", isLogin, noCache, profileController.getReferrals);

router.get("/productDetail/:id", getProductsDetail);
router.get("/shop", getShopPage);


router.get("/wishlist", isLogin, noCache, wishlistController.getWishlist);
router.post("/wishlist/add/:productId", isLogin, wishlistController.addToWishlist);
router.delete("/wishlist/remove/:productId", isLogin, wishlistController.removeFromWishlist);



router.get("/cart", isLogin, noCache, cartController.getCart);
router.post("/cart/add", isLogin, cartController.addToCart);
router.put("/cart/update", isLogin, cartController.updateCartQuantity);
router.delete("/cart/remove", isLogin, cartController.removeFromCart);
router.delete("/cart/delete", isLogin, cartController.removeAll);

router.get("/checkout", isLogin, noCache, checkoutController.getCheckoutPage);
router.post("/checkout/place-order", isLogin, checkoutController.placeOrder);
router.get("/checkout/success", isLogin, noCache, checkoutController.getSuccessPage);

router.get("/orders", isLogin, noCache, orderController.getOrders);
router.get("/orders/:id", isLogin, noCache, orderController.getOrderDetail);
router.post("/orders/:id/cancel", isLogin, orderController.cancelOrder);
router.post("/orders/:id/cancel-item", isLogin, orderController.cancelOrderItem);
router.post("/orders/:id/return", isLogin, orderController.returnOrder);
router.get("/orders/:id/invoice", isLogin, orderController.downloadInvoice);

export default router;
