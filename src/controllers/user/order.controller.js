import Order from "../../models/Order.model.js";
import Product from "../../models/Product.model.js";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";


const getUserId = (req) => {
  return (
    req.user?._id ||
    req.session?.user?._id ||
    req.session?.user?.id
  );
};

// GET /orders - Listing user orders with optional search and tab filtering
export const getOrders = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.redirect("/auth/login");
    }

    const search = req.query.search ? req.query.search.trim() : "";
    const currentTab = req.query.tab ? req.query.tab.trim() : "All";
    
    let query = { userId };

    if (currentTab !== "All") {
      if (currentTab === "Pending") {
        query.status = { $in: ["Pending", "Processing"] };
      } else if (currentTab === "Shipped") {
        query.status = "Shipped";
      } else if (currentTab === "Delivered") {
        query.status = "Delivered";
      } else if (currentTab === "Cancelled") {
        query.status = "Cancelled";
      } else if (currentTab === "Returned") {
        query.status = { $in: ["Returned", "Return Requested"] };
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { orderId: searchRegex },
        { "items.productName": searchRegex },
        { status: searchRegex }
      ];
    }

    // Sort by most recent order date
    const orders = await Order.find(query).sort({ createdAt: -1 });

    let date = new Date();

    res.render("user/orders", {
      title: "My Orders | Nafahath Perfumes",
      orders,
      search,
      currentTab,
      activePage: "orders",
      date
    });
  } catch (error) {
    console.error("Error loading order list:", error);
    res.redirect("/profile");
  }
};

// GET /orders/:id - Order detail page
export const getOrderDetail = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = req.params.id;

    if (!userId) {
      return res.redirect("/auth/login");
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.redirect("/orders?error=Order not found");
    }

    let time = Date.now();

    res.render("user/orderDetail", {
      title: `Order Details #${order.orderId} | Nafahath Perfumes`,
      order,
      activePage: "orders",
      time
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.redirect("/orders");
  }
};

// POST /orders/:id/cancel - Cancel entire order (stock increment)
export const cancelOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = req.params.id;
    const { reason, comments } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized login required." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Orders that are already Shipped, Delivered, Cancelled or Returned cannot be cancelled
    if (["Shipped", "Delivered", "Cancelled", "Returned", "Return Requested"].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled because it is already ${order.status.toLowerCase()}.` 
      });
    }

    if (reason === "Other reason" && (!comments || comments.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Please enter your cancellation reason in the comments field."
      });
    }

    const displayReason = (reason === "Other reason" && comments) ? comments : (reason || "Cancelled by customer");

    // Process each item and increment stock back
    for (const item of order.items) {
      if (item.status !== "Cancelled" && item.status !== "Returned") {
        item.status = "Cancelled";
        item.cancellationReason = displayReason;
        item.cancellationComments = comments || "";

        // Increment stock in database for real product variants
        if (mongoose.Types.ObjectId.isValid(item.productId)) {
          const product = await Product.findById(item.productId);
          if (product) {
            const variantObj = product.variants.find(
              v => v._id.toString() === item.variantId.toString()
            ) || product.variants[0];
            if (variantObj) {
              variantObj.stock += item.quantity;
              variantObj.cancelledCount = (variantObj.cancelledCount || 0) + item.quantity;
              await product.save();
            }
          }
        }
      }
    }

    order.status = "Cancelled";
    order.cancellationReason = displayReason;
    order.cancellationComments = comments || "";
    if (order.paymentStatus === "Paid") {
      order.paymentStatus = "Refunded";
    }
    await order.save();

    res.status(200).json({ success: true, message: "Your order has been cancelled successfully.", orderId: order.orderId });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Failed to cancel order. Please try again." });
  }
};

// POST /orders/:id/cancel-item - Cancel specific product variant in order (stock increment)
export const cancelOrderItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = req.params.id;
    const { itemId, reason, comments } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized login required." });
    }

    if (!itemId) {
      return res.status(400).json({ success: false, message: "Product item ID is required." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (["Shipped", "Delivered", "Cancelled", "Returned", "Return Requested"].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Items cannot be cancelled because the overall order is already ${order.status.toLowerCase()}.` 
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Product item not found in this order." });
    }

    if (["Cancelled", "Returned"].includes(item.status)) {
      return res.status(400).json({ success: false, message: "This item has already been cancelled or returned." });
    }

    if (reason === "Other reason" && (!comments || comments.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Please enter your cancellation reason in the comments field."
      });
    }

    // Cancel item and update stock
    const itemDisplayReason = (reason === "Other reason" && comments) ? comments : (reason || "Cancelled by customer");
    item.status = "Cancelled";
    item.cancellationReason = itemDisplayReason;
    item.cancellationComments = comments || "";

    // Increment variant stock
    if (mongoose.Types.ObjectId.isValid(item.productId)) {
      const product = await Product.findById(item.productId);
      if (product) {
        const variantObj = product.variants.find(
          v => v._id.toString() === item.variantId.toString()
        ) || product.variants[0];
        if (variantObj) {
          variantObj.stock += item.quantity;
          variantObj.cancelledCount = (variantObj.cancelledCount || 0) + item.quantity;
          await product.save();
        }
      }
    }

    // Check if ALL items in order are now cancelled
    const allCancelled = order.items.every(it => it.status === "Cancelled");
    if (allCancelled) {
      order.status = "Cancelled";
      order.cancellationReason = "All items in this order were cancelled";
      order.cancellationComments = comments || "";
      if (order.paymentStatus === "Paid") {
        order.paymentStatus = "Refunded";
      }
    }

    await order.save();

    res.status(200).json({ success: true, message: "The product item has been cancelled successfully." });
  } catch (error) {
    console.error("Error cancelling specific item:", error);
    res.status(500).json({ success: false, message: "Failed to cancel product item. Please try again." });
  }
};

// POST /orders/:id/return - Return delivered order (mandatory reason, pickup method, dates)
export const returnOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = req.params.id;
    const { reason, comments, pickupMethod, pickupDate, images } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized login required." });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ success: false, message: "Return reason is mandatory." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Return is only allowed when status is Delivered
    if (order.status !== "Delivered") {
      return res.status(400).json({ 
        success: false, 
        message: "Orders can only be returned after they have been successfully delivered." 
      });
    }

    const pDate = pickupDate ? new Date(pickupDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    order.status = "Returned";
    order.returnReason = reason;
    order.returnComments = comments || "";
    order.returnPickupMethod = pickupMethod || "Pick up from my address";
    order.returnPickupDate = pDate;
    if (Array.isArray(images) && images.length > 0) {
      order.returnImages = images;
    }
    order.returnStatus = "Return Requested";
    order.returnTimeline = {
      requestedAt: new Date(),
      pickupScheduledAt: pDate,
      pickedUpAt: new Date(pDate.getTime() + 24 * 60 * 60 * 1000),
      underReviewAt: new Date(pDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      refundInitiatedAt: new Date(pDate.getTime() + 3 * 24 * 60 * 60 * 1000)
    };

    // Process items that were delivered and return stock
    for (const item of order.items) {
      if (item.status === "Pending" || item.status === "Processing" || item.status === "Shipped" || item.status === "Delivered") {
        item.status = "Returned";
        item.returnReason = reason;
        item.returnComments = comments || "";

        // Increment variant stock
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

    await order.save();

    res.status(200).json({ 
      success: true, 
      message: "Your return request has been submitted successfully.", 
      pickupDate: pDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      orderId: order.orderId 
    });
  } catch (error) {
    console.error("Error returning order:", error);
    res.status(500).json({ success: false, message: "Failed to return order. Please try again." });
  }
};

// GET /orders/:id/invoice - Download invoice PDF
export const downloadInvoice = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = req.params.id;

    if (!userId) {
      return res.redirect("/auth/login");
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.redirect("/orders?error=Order not found");
    }

    // Filter non-cancelled items
    const activeItems = (order.items || []).filter(item => item.status !== "Cancelled");

    // If order status is Cancelled or no active items remain, block invoice download
    if (activeItems.length === 0 || order.status === "Cancelled") {
      return res.redirect("/orders?error=Invoice is not available for cancelled orders");
    }

    // Calculate active subtotal and active financials
    const activeSubtotal = activeItems.reduce((sum, item) => sum + (item.totalPrice || (item.price * item.quantity)), 0);
    const originalSubtotal = order.subtotal || activeSubtotal;
    const ratio = originalSubtotal > 0 ? (activeSubtotal / originalSubtotal) : 1;
    
    const activeDiscount = (order.discount || 0) * ratio;
    const activeShipping = order.shipping || 0;
    const activeTaxes = (order.taxes || 0) * ratio;
    const activeFinalTotal = Math.max(0, activeSubtotal - activeDiscount + activeShipping + activeTaxes);

    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers to prompt download of file
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice-${order.orderId}.pdf`);
    
    doc.pipe(res);

    // ── PDF HEADER BANNER ──
    doc.fillColor("#060a12").rect(0, 0, 612, 120).fill(); // Navy dark banner background
    
    // Title/Logo
    doc.fillColor("#C5A267").font("Times-Bold").fontSize(26).text("NAFAHATH", 50, 35, { characterSpacing: 2 });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("PERFUMES & FRAGRANCES", 52, 65, { characterSpacing: 1 });
    
    // Right meta
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text("INVOICE", 400, 35, { align: "right" });
    doc.fillColor("#A0AEC0").font("Helvetica").fontSize(9).text(`Invoice No: ${order.orderId}`, 400, 58, { align: "right" });
    const invoiceDate = new Date(order.createdAt);
    const formattedDate = `${String(invoiceDate.getDate()).padStart(2, '0')}/${String(invoiceDate.getMonth() + 1).padStart(2, '0')}/${invoiceDate.getFullYear()}`;
    doc.fillColor("#A0AEC0").font("Helvetica").fontSize(9).text(`Date: ${formattedDate}`, 400, 72, { align: "right" });

    // Move y below banner
    doc.y = 150;

    // ── BILLING & PAYMENT INFO ──
    doc.fillColor("#1a202c").font("Helvetica-Bold").fontSize(11).text("BILL TO:", 50, 150);
    doc.font("Helvetica").fontSize(9).fillColor("#4a5568");
    doc.text(order.shippingAddress.fullName, 50, 168);
    doc.text(order.shippingAddress.addressLine, 50, 181, { width: 220 });
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}`, 50, doc.y + 2);
    doc.text(`Phone: ${order.shippingAddress.phone}`, 50, doc.y + 2);

    doc.fillColor("#1a202c").font("Helvetica-Bold").fontSize(11).text("ORDER SUMMARY:", 330, 150);
    doc.font("Helvetica").fontSize(9).fillColor("#4a5568");
    doc.text(`Payment Method: ${order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : order.paymentMethod}`, 330, 168);
    doc.text(`Payment Status: ${order.paymentStatus}`, 330, 181);
    doc.text(`Order Status: ${order.status}`, 330, 194);

    // ── TABLE OF ITEMS ──
    let yPos = 245;
    
    // Table Header
    doc.fillColor("#edf2f7").rect(50, yPos, 512, 22).fill();
    doc.fillColor("#2d3748").font("Helvetica-Bold").fontSize(8.5);
    doc.text("SL.", 60, yPos + 6);
    doc.text("PRODUCT DESCRIPTION", 95, yPos + 6);
    doc.text("SIZE", 310, yPos + 6);
    doc.text("PRICE", 365, yPos + 6, { width: 50, align: "right" });
    doc.text("QTY", 435, yPos + 6, { width: 30, align: "center" });
    doc.text("TOTAL", 485, yPos + 6, { width: 70, align: "right" });

    yPos += 22;
    doc.font("Helvetica").fontSize(8.5).fillColor("#4a5568");
    
    let index = 1;
    for (const item of activeItems) {
      // Draw border bottom for row
      doc.strokeColor("#e2e8f0").lineWidth(0.8).moveTo(50, yPos + 26).lineTo(562, yPos + 26).stroke();
      
      doc.text(index.toString(), 60, yPos + 9);
      
      let itemTitle = item.productName;
      if (item.status === "Returned") itemTitle += " (Returned)";
      
      doc.fillColor("#2d3748").font("Helvetica-Bold").text(itemTitle, 95, yPos + 5);
      doc.fillColor("#718096").font("Helvetica").fontSize(7.5).text(item.brand, 95, yPos + 15);
      doc.fontSize(8.5);
      
      doc.text(item.size, 310, yPos + 9);
      doc.text(`INR ${item.price.toFixed(2)}`, 365, yPos + 9, { width: 50, align: "right" });
      doc.text(item.quantity.toString(), 435, yPos + 9, { width: 30, align: "center" });
      doc.text(`INR ${(item.totalPrice || (item.price * item.quantity)).toFixed(2)}`, 485, yPos + 9, { width: 70, align: "right" });
      
      yPos += 26;
      index++;
    }

    // ── TOTALS BLOCK ──
    yPos += 15;
    
    const drawTotalRow = (label, amount, isBold = false) => {
      doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fillColor(isBold ? "#2d3748" : "#718096");
      doc.text(label, 350, yPos, { width: 120, align: "right" });
      doc.text(`INR ${amount.toFixed(2)}`, 485, yPos, { width: 72, align: "right" });
      yPos += 16;
    };

    drawTotalRow("Subtotal:", activeSubtotal);
    if (activeDiscount > 0) drawTotalRow("Discount Applied:", -activeDiscount);
    if (activeShipping > 0) drawTotalRow("Shipping Fees:", activeShipping);
    if (activeTaxes > 0) drawTotalRow("Estimated Taxes (GST 18%):", activeTaxes);
    
    yPos += 4;
    doc.strokeColor("#cbd5e0").lineWidth(1.2).moveTo(350, yPos).lineTo(562, yPos).stroke();
    yPos += 8;
    
    drawTotalRow("Final Total Paid:", activeFinalTotal, true);

    // ── FOOTER SIGN-OFF ──
    yPos = 710;
    doc.strokeColor("#e2e8f0").lineWidth(0.8).moveTo(50, yPos).lineTo(562, yPos).stroke();
    
    doc.fillColor("#a0aec0").font("Helvetica-Oblique").fontSize(8).text(
      "This is a system generated invoice copy from Nafahath Perfumes. For exchange and queries, contact support@nafahath.com",
      50, yPos + 12, { align: "center", width: 512 }
    );

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.redirect("/orders?error=Failed to generate invoice");
  }
};
