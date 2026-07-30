import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import Wishlist from "../src/models/Wishlist.model.js";
import Product from "../src/models/Product.model.js";
import { connectDB } from "../src/config/db.js";

async function testPopulate() {
    await connectDB();
    const wishlist = await Wishlist.findOne({}).populate({
        path: 'products',
        select: 'isDeleted',
        match: { isDeleted: false }
    }).lean();
    
    console.log("Products array:");
    console.log(wishlist.products);
    console.log("Length:", wishlist.products.length);
    console.log("Filtered Length:", wishlist.products.filter(p => p !== null).length);
    process.exit(0);
}

testPopulate();
