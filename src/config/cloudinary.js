import dotenv from "dotenv";
dotenv.config();
import { v2 as cloudinary } from "cloudinary";
import CloudinaryStorage from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000  // 60 seconds
});

// Storage Engine set cheyyunnu
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'Nafahath_User_Profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ 
  storage: storage,
  limits: {fileSize: 2 * 1024 * 1024}
});

export { cloudinary, upload };