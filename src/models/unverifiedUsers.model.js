// models/UnverifiedUser.js
import mongoose from "mongoose";

const unverifiedUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    //  Document TTL (MongoDB handles deletion)
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 1200, // 20 minutes
    },    
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("UnverifiedUser", unverifiedUserSchema);