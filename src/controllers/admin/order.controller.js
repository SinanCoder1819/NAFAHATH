import Order from "../../models/Order.model.js";
import Product from "../../models/Product.model.js";
import User from "../../models/User.model.js";
import mongoose from "mongoose";

const PAGE_SIZE = 10;

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET /admin/orders - Order listing with Search, Filter, Sort, and Pagination
export const getOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || "").trim();
    const statusFilter = req.query.status || "";
    const sortBy = req.query.sortBy || "createdAt_desc";

    const filter = {};

    // 1. Status Filter
    if (statusFilter) {
      filter.status = statusFilter;
    }

    // 2. Search (matches Order ID, shipping address name/phone, or user name/email)
    if (search) {
      const safeSearch = escapeRegex(search);
      const searchConditions = [
        { orderId: { $regex: safeSearch, $options: "i" } },
        { "shippingAddress.fullName": { $regex: safeSearch, $options: "i" } },
        { "shippingAddress.phone": { $regex: safeSearch, $options: "i" } }
      ];

      // Search matching users by name/email
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } }
        ]
      }).select("_id");

      if (matchedUsers.length > 0) {
        const userIds = matchedUsers.map(u => u._id);
        searchConditions.push({ userId: { $in: userIds } });
      }

      filter.$or = searchConditions;
    }

    // 3. Sorting (Default: Descending by order date)
    let sortOption = { createdAt: -1 };
    if (sortBy === "createdAt_asc") {
      sortOption = { createdAt: 1 };
    } else if (sortBy === "total_desc") {
      sortOption = { finalTotal: -1 };
    } else if (sortBy === "total_asc") {
      sortOption = { finalTotal: 1 };
    }

    // 4. Pagination
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const orders = await Order.find(filter)
      .populate("userId", "name email phone")
      .sort(sortOption)
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();

    res.render("admin/orders", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "orders",
      orders,
      search,
      statusFilter,
      sortBy,
      currentPage,
      totalPages,
      success: req.query.success || "",
      error: req.query.error || ""
    });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).send("Server Error loading orders");
  }
};

// GET /admin/orders/:id - View detail of an order
export const getOrderDetail = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.redirect("/admin/orders?error=Invalid Order ID");
    }

    const order = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .lean();

    if (!order) {
      return res.redirect("/admin/orders?error=Order not found");
    }

    res.render("admin/orderDetail", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "orders",
      order,
      success: req.query.success || "",
      error: req.query.error || ""
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("Server Error loading order details");
  }
};

// POST /admin/orders/:id/status - Change order status
export const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status: newStatus, cancellationReason, returnReason } = req.body;

    const validStatuses = ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned"];
    
    if (!validStatuses.includes(newStatus)) {
      return res.redirect(`/admin/orders/${orderId}?error=Invalid status selection`);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(`/admin/orders?error=Order not found`);
    }

    const oldStatus = order.status;

    // If already in final states, limit updates
    if (["Cancelled", "Returned"].includes(oldStatus)) {
      return res.redirect(`/admin/orders/${orderId}?error=Cannot change status of a ${oldStatus.toLowerCase()} order.`);
    }

    // Set order status
    order.status = newStatus;

    if (newStatus === "Cancelled") {
      order.cancellationReason = cancellationReason || "Cancelled by admin";
    } else if (newStatus === "Returned") {
      order.returnReason = returnReason || "Returned by admin";
    }

    // If changing to Cancelled or Returned, restore variant stocks
    if (["Cancelled", "Returned"].includes(newStatus)) {
      for (const item of order.items) {
        if (item.status !== "Cancelled" && item.status !== "Returned") {
          item.status = newStatus;
          if (newStatus === "Cancelled") {
            item.cancellationReason = cancellationReason || "Cancelled by admin";
          } else {
            item.returnReason = returnReason || "Returned by admin";
          }

          // Restore product variant stock
          if (mongoose.Types.ObjectId.isValid(item.productId)) {
            const product = await Product.findById(item.productId);
            if (product) {
              const variantObj = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
              ) || product.variants[0];
              if (variantObj) {
                variantObj.stock += item.quantity;
                await product.save();
              }
            }
          }
        }
      }
    } else {
      // If changing to a normal status, we update items' statuses as well (unless they were explicitly cancelled/returned individually)
      for (const item of order.items) {
        if (item.status !== "Cancelled" && item.status !== "Returned") {
          item.status = newStatus;
        }
      }
    }

    // For Cash on Delivery (COD), mark paymentStatus as Paid ONLY when Delivered; reset to Pending for active pre-delivery stages
    if (newStatus === "Delivered") {
      order.paymentStatus = "Paid";
    } else if (["Pending", "Processing", "Shipped", "Out for Delivery"].includes(newStatus)) {
      order.paymentStatus = "Pending";
    }

    await order.save();

    res.redirect(`/admin/orders/${orderId}?success=Order status updated successfully to ${newStatus}`);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.redirect(`/admin/orders/${req.params.id}?error=Failed to update order status`);
  }
};

// POST /admin/orders/:id/return-status - Update order return stage timeline
export const updateReturnStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { returnStatus } = req.body;

    const validReturnStatuses = [
      "Return Requested",
      "Pick Up Scheduled",
      "Picked Up",
      "Under Review",
      "Refund Initiated",
      "Refund Completed"
    ];

    if (!validReturnStatuses.includes(returnStatus)) {
      return res.redirect(`/admin/orders/${orderId}?error=Invalid return status stage selection`);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(`/admin/orders?error=Order not found`);
    }

    order.returnStatus = returnStatus;
    if (!order.returnTimeline) {
      order.returnTimeline = {};
    }

    const now = new Date();
    if (returnStatus === "Return Requested" && !order.returnTimeline.requestedAt) {
      order.returnTimeline.requestedAt = now;
    } else if (returnStatus === "Pick Up Scheduled" && !order.returnTimeline.pickupScheduledAt) {
      order.returnTimeline.pickupScheduledAt = now;
    } else if (returnStatus === "Picked Up" && !order.returnTimeline.pickedUpAt) {
      order.returnTimeline.pickedUpAt = now;
    } else if (returnStatus === "Under Review" && !order.returnTimeline.underReviewAt) {
      order.returnTimeline.underReviewAt = now;
    } else if (returnStatus === "Refund Initiated") {
      if (!order.returnTimeline.refundInitiatedAt) order.returnTimeline.refundInitiatedAt = now;
      order.paymentStatus = "Refunded";
    } else if (returnStatus === "Refund Completed") {
      if (!order.returnTimeline.refundCompletedAt) order.returnTimeline.refundCompletedAt = now;
      order.paymentStatus = "Refunded";
    }

    await order.save();

    res.redirect(`/admin/orders/${orderId}?success=Return status stage updated to ${returnStatus}`);
  } catch (error) {
    console.error("Error updating return status stage:", error);
    res.redirect(`/admin/orders/${req.params.id}?error=Failed to update return status stage`);
  }
};
