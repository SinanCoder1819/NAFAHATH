import mongoose from "mongoose";
import dotenv from "dotenv";
import Cart from "../src/models/Cart.model.js";
import User from "../src/models/User.model.js";
import Product from "../src/models/Product.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Nafahath";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: "testuser@example.com" });
    if (!user) {
      console.log("User testuser@example.com not found!");
      return;
    }

    const userId = user._id;
    console.log("User ID:", userId);

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId"
    });

    if (!cart) {
      console.log("No cart found for user.");
      return;
    }

    console.log("Cart items count:", cart.items.length);
    
    // Let's run the mapping code and see if it throws!
    const validItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
    console.log("Valid items count:", validItems.length);

    const displayItems = validItems.map((item, idx) => {
      console.log(`Mapping item ${idx}:`, {
        productId: item.productId ? item.productId._id : null,
        productName: item.productId ? item.productId.productName : null,
        variantId: item.variantId,
        variantsLength: item.productId && item.productId.variants ? item.productId.variants.length : "undefined"
      });

      if (!item.productId || !item.productId.variants) {
        throw new Error(`productId or variants is missing on item ${idx}`);
      }

      const variantObj = item.productId.variants.find(
        v => v._id.toString() === item.variantId.toString()
      );
      
      console.log(`Found variantObj:`, variantObj ? variantObj._id : "not found");

      return {
        productId: item.productId._id,
        variantId: item.variantId,
        productName: item.productId.productName,
        brand: item.productId.brand,
        primaryImage: item.productId.primaryImage,
        size: variantObj ? variantObj.size : "100ml",
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        regularPrice: variantObj ? variantObj.regularPrice : item.price,
        hasDiscount: variantObj ? (variantObj.salePrice > 0) : false,
        discountPercent: variantObj && variantObj.salePrice > 0 ? Math.round(((variantObj.regularPrice - variantObj.salePrice) / variantObj.regularPrice) * 100) : 0
      };
    });

    console.log("Mapping Succeeded! displayItems:", displayItems);

  } catch (err) {
    console.error("Mapping Failed with error:\n", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
