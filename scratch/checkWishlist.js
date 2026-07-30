import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import Wishlist from "../src/models/Wishlist.model.js";
import { connectDB } from "../src/config/db.js";

async function checkWishlist() {
    await connectDB();
    const wishlists = await Wishlist.find({});
    console.log("All wishlists:");
    console.log(JSON.stringify(wishlists, null, 2));
    process.exit(0);
}

checkWishlist();
