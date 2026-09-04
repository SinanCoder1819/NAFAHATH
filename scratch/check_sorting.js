import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/Product.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Nafahath";

async function testRelated() {
  try {
    await mongoose.connect(MONGO_URI);
    const products = await Product.find({ isDeleted: false }).lean();
    for (const product of products) {
      const related = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        isDeleted: false
      }).limit(4).lean();
      console.log(`Product: ${product.productName} (Category: "${product.category}") -> Found ${related.length} related products:`, related.map(r => r.productName));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

testRelated();
