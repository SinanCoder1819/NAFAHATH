import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../src/models/Order.model.js";
import User from "../src/models/User.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Nafahath";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: "testuser@example.com" });
    if (!user) {
      console.log("Test user not found");
      return;
    }

    const order = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!order) {
      console.log("No orders found for test user");
      return;
    }

    console.log(`Updating order ${order.orderId} from status "${order.status}" to "Delivered"`);
    order.status = "Delivered";
    order.paymentStatus = "Paid";
    
    for (const item of order.items) {
      if (item.status !== "Cancelled") {
        item.status = "Delivered";
      }
    }

    await order.save();
    console.log("Order updated successfully to Delivered!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
