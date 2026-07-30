import dotenv from "dotenv";
dotenv.config();

import cloudinaryPackage from "cloudinary";
import cloudinaryStorage from "multer-storage-cloudinary";
import multer from "multer";

const { v2: cloudinary } = cloudinaryPackage;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = cloudinaryStorage({
  cloudinary: cloudinaryPackage,
  params: {
    folder: "Nafahath_User_Profiles",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});



// --- ADD THIS NEW PRODUCT STORAGE ---
const productStorage = cloudinaryStorage({
  cloudinary: cloudinaryPackage,
  params: {
    folder: "Nafahath_Products", // Saves to a separate folder in Cloudinary!
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});
const uploadProduct = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for high-quality product images
});

export { cloudinary, upload, uploadProduct };
