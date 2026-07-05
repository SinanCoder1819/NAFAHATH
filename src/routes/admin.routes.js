import express from "express";
import { getAdminLogin, postAdminLogin, getAdminLogout } from "../controllers/admin/auth.controller.js";
import { isAdmin } from "../middlewares/admin.middleware.js";
import { isAdminLogout, noCache } from "../middlewares/auth.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import { getCustomers, toggleBlockUser } from "../controllers/admin/customers.controller.js";
import { getCategories, addCategory, updateCategory, softDeleteCategory, restoreCategory } from "../controllers/admin/category.controller.js";
import { getProducts, getAddProduct, postAddProduct, getEditProduct, postEditProduct, deleteProduct } from "../controllers/admin/products.controller.js";
import { uploadProduct } from "../config/cloudinary.js";


const router = express.Router();


router.get("/login",  isAdminLogout, noCache, getAdminLogin);
router.post("/login", postAdminLogin);
router.post("/logout", getAdminLogout);


router.use(isAdmin);

router.get("/dashboard", getDashboard);
router.get("/customers", getCustomers);
router.patch("/customers/:id/block", toggleBlockUser);

router.get("/categories", getCategories);
router.post("/categories", addCategory);
router.post("/categories/:id/edit", updateCategory);
router.post("/categories/:id/delete", softDeleteCategory);
router.post("/categories/:id/restore", restoreCategory);


router.get('/products', getProducts)
router.get('/addProducts', getAddProduct)
router.post("/products/add", uploadProduct.fields([
    { name: 'primaryImage',  maxCount: 1 },
    { name: 'galleryImage1', maxCount: 1 },
    { name: 'galleryImage2', maxCount: 1 },
    { name: 'galleryImage3', maxCount: 1 },
    { name: 'galleryImage4', maxCount: 1 }
]), postAddProduct);
router.get("/products/edit/:id", getEditProduct);
router.post("/products/edit/:id", uploadProduct.fields([
    { name: 'primaryImage',  maxCount: 1 },
    { name: 'galleryImage1', maxCount: 1 },
    { name: 'galleryImage2', maxCount: 1 },
    { name: 'galleryImage3', maxCount: 1 },
    { name: 'galleryImage4', maxCount: 1 }
]), postEditProduct);
router.post("/products/delete/:id", deleteProduct);





export default router;
 