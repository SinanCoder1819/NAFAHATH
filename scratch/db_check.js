import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Nafahath";
console.log("Connecting to:", MONGO_URI);

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  isBlocked: Boolean
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully!");

    const users = await User.find({ role: "user" }).lean();
    console.log("Existing Users:", users.map(u => ({ name: u.name, email: u.email, isBlocked: u.isBlocked })));

    let testUser = users.find(u => u.email === "testuser@example.com");
    if (!testUser) {
      console.log("Creating test user: testuser@example.com...");
      const hashedPassword = await bcrypt.hash("password123", 10);
      testUser = await User.create({
        name: "Test User",
        email: "testuser@example.com",
        password: hashedPassword,
        role: "user",
        isBlocked: false
      });
      console.log("Test user created successfully!");
    } else {
      console.log("Test user testuser@example.com already exists.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
