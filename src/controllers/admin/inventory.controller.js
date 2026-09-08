import Product from "../../models/Product.model.js";
import mongoose from "mongoose";

const PAGE_SIZE = 10;

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET /admin/inventory - List products with variant stocks
export const getInventory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || "").trim();
    const stockStatus = req.query.stockStatus || ""; // "out", "low", "ok", or empty (all)

    const filter = { isDeleted: false };

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { productName: { $regex: safeSearch, $options: "i" } },
        { brand: { $regex: safeSearch, $options: "i" } },
        { category: { $regex: safeSearch, $options: "i" } }
      ];
    }

    if (stockStatus === "out") {
      filter.variants = { $elemMatch: { stock: 0 } };
    } else if (stockStatus === "low") {
      filter.variants = { $elemMatch: { stock: { $gt: 0, $lt: 10 } } };
    } else if (stockStatus === "ok") {
      filter.variants = { $elemMatch: { stock: { $gte: 10 } } };
    }

    

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const products = await Product.find(filter)
      .sort({ productName: 1 })
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();

    res.render("admin/inventory", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "inventory",
      products,
      search,
      stockStatus,
      currentPage,
      totalPages,
      success: req.query.success || "",
      error: req.query.error || ""
    });
  } catch (error) {
    console.error("Error fetching admin inventory:", error);
    res.status(500).send("Server Error loading inventory");
  }
};

// PATCH /admin/inventory/update - Update a variant's stock level via AJAX
export const updateInventoryStock = async (req, res) => {
  try {
    const { productId, variantId, stock } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid Product or Variant ID" });
    }

    const newStock = parseInt(stock);
    if (isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ success: false, message: "Stock must be a non-negative number" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $set: { "variants.$.stock": newStock } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product variant not found" });
    }

    // Calculate total stock of this product to see if status changed
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const statusLabel = totalStock === 0 ? "Out of Stock" : totalStock < 10 ? "Low Stock" : "In Stock";
    const statusClass = totalStock === 0 ? "--outofstock" : totalStock < 10 ? "--low" : "--instock";

    res.json({
      success: true,
      message: "Stock updated successfully",
      newStock,
      totalStock,
      statusLabel,
      statusClass
    });
  } catch (error) {
    console.error("Error updating variant stock:", error);
    res.status(500).json({ success: false, message: "Server error updating stock" });
  }
};
