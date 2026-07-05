
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    
    phone: {
      type: String,
      required: false,
      default: null
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true
    },

    password: {
      type: String,
      default: null
    },

    role: {
      type: String,
      enum:["user","admin"],
      default: "user"
    },

    profileImage: {
      type: String,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

     referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true
      },

    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },

    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],


  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);