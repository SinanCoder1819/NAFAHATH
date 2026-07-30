import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import Product from "../src/models/Product.model.js";
import { connectDB } from "../src/config/db.js";

async function checkProduct() {
    await connectDB();
    const product = await Product.findById("6a549da253e5db22ffd2e06f");
    console.log("Product:");
    console.log(JSON.stringify(product, null, 2));
    process.exit(0);
}

checkProduct();
