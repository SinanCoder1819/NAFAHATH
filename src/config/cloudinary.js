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

export { cloudinary, upload };
