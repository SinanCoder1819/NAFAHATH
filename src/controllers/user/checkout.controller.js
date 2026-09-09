import Address from "../../models/Address.model.js";
import Cart from "../../models/Cart.model.js";
import Product from "../../models/Product.model.js";
import Order from "../../models/Order.model.js";
import mongoose from "mongoose";
import * as paymentService from "../../services/payment.service.js";
import razorpayConfig from "../../config/payment.js";

// Helper to get user ID
const getUserId = (req) => {
  return (
    req.user?._id ||
    req.session?.user?._id ||
    req.session?.user?.id
  );
};

// GET /checkout
export const getCheckoutPage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { singleItem, productId, variantId } = req.query;
    const isSingleItem = singleItem === "true" && Boolean(productId && variantId);
    
    // Fetch addresses
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    // Fetch user's cart
    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
    });

    let displayItems = [];
    let originalSubtotal = 0;
    let productDiscount = 0;
    let subtotal = 0;
    let isMockData = false;

    // Check if we have active items in the real cart
    if (cart && cart.items && cart.items.length > 0) {
      let validItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
      
      if (isSingleItem) {
        validItems = validItems.filter(
          item => item.productId._id.toString() === productId && item.variantId.toString() === variantId
        );
      }

      displayItems = validItems.map(item => {
        const variantObj = item.productId.variants.find(
          v => v._id.toString() === item.variantId.toString()
        );
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

      displayItems.forEach(item => {
        originalSubtotal += item.regularPrice * item.quantity;
        productDiscount += (item.regularPrice - item.price) * item.quantity;
      });
      subtotal = originalSubtotal - productDiscount;
    } else {
      isMockData = true;
      // Elegant mock data backfill
      displayItems = [
        {
          productId: "mock-prod-1",
          variantId: "mock-var-1",
          productName: "Oud Noir Impérial",
          brand: "Nafahath Signature",
          primaryImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=300&q=80",
          size: "100ml",
          quantity: 1,
          price: 2499,
          totalPrice: 2499,
          regularPrice: 2499,
          hasDiscount: false,
          discountPercent: 0
        },
        {
          productId: "mock-prod-2",
          variantId: "mock-var-2",
          productName: "Rose Majestic Extrait",
          brand: "Nafahath Private Blend",
          primaryImage: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=300&q=80",
          size: "50ml",
          quantity: 2,
          price: 1599,
          totalPrice: 3198,
          regularPrice: 1999,
          hasDiscount: true,
          discountPercent: 20
        }
      ];
      displayItems.forEach(item => {
        originalSubtotal += item.regularPrice * item.quantity;
        productDiscount += (item.regularPrice - item.price) * item.quantity;
      });
      subtotal = originalSubtotal - productDiscount;
    }

    // Dynamic math logic calculation
    subtotal = displayItems.reduce((acc, i) => acc + i.totalPrice, 0);

    let originalPriceTotal = 0;
    displayItems.forEach(item => {
      const realProduct = cart ? cart.items.find(ci => ci.productId && ci.productId._id.toString() === item.productId.toString()) : null;
      if (realProduct && realProduct.productId && realProduct.productId.variants) {
        const v = realProduct.productId.variants.find(v => v._id.toString() === item.variantId.toString()) || realProduct.productId.variants[0];
        if (v) {
          originalPriceTotal += v.regularPrice * item.quantity;
        } else {
          originalPriceTotal += item.totalPrice;
        }
      } else {
        originalPriceTotal += item.totalPrice;
      }
    });

    productDiscount = Math.max(0, originalPriceTotal - subtotal);
    let isCouponApplied = false;
    let discountAmount = 0;
    let couponCode = "";

    if (req.session.appliedCoupon) {
      isCouponApplied = true;
      discountAmount = req.session.appliedCoupon.discountAmount || 0;
      couponCode = req.session.appliedCoupon.code || "";
    }

    let finalTotal = Math.max(0, subtotal - discountAmount);

    res.render("user/checkout", {
      addresses,
      displayItems,
      items: displayItems,
      subtotal,
      originalPriceTotal,
      originalSubtotal: originalPriceTotal,
      productDiscount,
      discountAmount,
      discount: discountAmount,
      shipping: 0,
      taxes: Math.round(subtotal * 0.18),
      isCouponApplied,
      couponCode,
      finalTotal,
      isMockData,
      user: req.session.user,
      activePage: "checkout",
      isSingleItem,
      singleProductId: isSingleItem ? productId : "",
      singleVariantId: isSingleItem ? variantId : "",
      razorpayKeyId: razorpayConfig.key_id
    });

  } catch (error) {
    console.error("Error displaying checkout page:", error);
    res.redirect("/cart");
  }
};

export const placeOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId, paymentMethod, singleItem, productId, variantId } = req.body;
    const isSingleItem = singleItem === true || singleItem === "true";

    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Delivery Address and Payment Method are required." });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: "Selected delivery address not found." });
    }

    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId' });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    let displayItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
    if (isSingleItem && productId && variantId) {
      displayItems = displayItems.filter(
        item => item.productId._id.toString() === productId && item.variantId.toString() === variantId
      );
    }

    if (displayItems.length === 0) {
      return res.status(400).json({ success: false, message: "No available products to purchase." });
    }

    const randNum = Math.floor(100000 + Math.random() * 900000);
    const orderId = `NF-2026-${randNum}`;

    let subtotal = 0;
    let orderItems = [];

    if (displayItems.length > 0) {
      // 1. Stock levels validation check
      for (const item of displayItems) {
        const variantObj = item.productId.variants.find(
          v => v._id.toString() === item.variantId.toString()
        ) || (item.productId.variants && item.productId.variants[0]);
        if (!variantObj) {
          return res.status(400).json({ success: false, message: `Variant for product "${item.productId.productName}" not found.` });
        }
        if (variantObj.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.productId.productName} (${variantObj.size}). Only ${variantObj.stock} left.`
          });
        }
      }

      // 2. Decrement variant stock
      for (const item of displayItems) {
        const variantObj = item.productId.variants.find(
          v => v._id.toString() === item.variantId.toString()
        ) || (item.productId.variants && item.productId.variants[0]);
        variantObj.stock -= item.quantity;
        await item.productId.save();

        orderItems.push({
          productId: item.productId._id,
          variantId: item.variantId,
          productName: item.productId.productName,
          brand: item.productId.brand,
          size: variantObj.size,
          primaryImage: item.productId.primaryImage,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          status: "Pending"
        });
      }

      subtotal = orderItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

      // Remove ordered items from cart (selective for single item, full clear for full cart)
      if (isSingleItem && productId && variantId) {
        cart.items = cart.items.filter(
          item => !(item.productId && item.productId._id.toString() === productId && item.variantId.toString() === variantId)
        );
      } else {
        cart.items = [];
      }
      cart.cartTotal = cart.items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
      await cart.save();
    } else {
      // Fallback mock order if cart is empty
      orderItems = [
        {
          productId: new mongoose.Types.ObjectId("65dfd5c41bc2222a0453d111"),
          variantId: new mongoose.Types.ObjectId("65dfd5c41bc2222a0453d112"),
          productName: "Oud Noir Impérial",
          brand: "Nafahath Signature",
          size: "100ml",
          primaryImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=300&q=80",
          quantity: 1,
          price: 2499,
          totalPrice: 2499,
          status: "Pending"
        },
        {
          productId: new mongoose.Types.ObjectId("65dfd5c41bc2222a0453d113"),
          variantId: new mongoose.Types.ObjectId("65dfd5c41bc2222a0453d114"),
          productName: "Rose Majestic Extrait",
          brand: "Nafahath Private Blend",
          size: "50ml",
          primaryImage: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=300&q=80",
          quantity: 2,
          price: 1599,
          totalPrice: 3198,
          status: "Pending"
        }
      ];
      subtotal = orderItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    }

    let discount = 0;
    if (req.session && req.session.appliedCoupon) {
      discount = req.session.appliedCoupon.discountAmount || 0;
    }

    const shipping = 0;
    const taxes = Math.round(subtotal * 0.18);
    const finalTotal = Math.max(0, subtotal - discount + shipping);

    // Create Order Document
    const newOrder = new Order({
      orderId,
      userId,
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        addressLine: address.addressLine,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        phone: address.phone
      },
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      subtotal,
      discount,
      shipping,
      taxes,
      finalTotal,
      status: "Pending"
    });

    await newOrder.save();

    if (req.session) {
      delete req.session.appliedCoupon;
    }

    res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId,
      finalTotal,
      paymentMethod,
      deliveryName: address.fullName,
      deliveryAddress: `${address.addressLine}, ${address.city}, ${address.state} - ${address.postalCode}`
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};



// GET /checkout/success
export const getSuccessPage = (req, res) => {
  const { orderId, name, address, total, paymentMethod } = req.query;

  // Map code to user-friendly label
  const methodMap = {
    COD: "Cash on Delivery (COD)",
    UPI: "UPI (Razorpay)",
  };

  res.render("user/checkoutSuccess", {
    title: "Order Placed | Nafahath Perfumes",
    orderId: orderId || "NF-2026-894762",
    deliveryName: name || "Customer",
    deliveryAddress: address || "Your Selected Delivery Address",
    finalTotal: total || "5,196",
    paymentMethodName: methodMap[paymentMethod] || "Cash on Delivery (COD)"
  });
};

// GET /checkout/failure
export const getFailurePage = (req, res) => {
  const { orderId, paymentMethod } = req.query;

  const methodMap = {
    COD: "Cash on Delivery (COD)",
    UPI: "UPI (Razorpay)",
  };

  res.render("user/paymentFailure", {
    title: "Payment Failed | Nafahath Perfumes",
    orderId: orderId || "N/A",
    paymentMethodName: methodMap[paymentMethod] || "Online Payment"
  });
};


// ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
//  RAZORPAY ONLINE PAYMENT FLOW
// ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

/**
 * POST /checkout/create-razorpay-order
 * Creates a Razorpay order (does NOT create DB order yet).
 * Returns razorpay order details to frontend for popup.
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId, singleItem, productId, variantId } = req.body;
    const isSingleItem = singleItem === true || singleItem === "true";

    if (!addressId) {
      return res.status(400).json({ success: false, message: "Delivery address is required." });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: "Selected delivery address not found." });
    }

    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId' });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    let displayItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
    if (isSingleItem && productId && variantId) {
      displayItems = displayItems.filter(
        item => item.productId._id.toString() === productId && item.variantId.toString() === variantId
      );
    }

    if (displayItems.length === 0) {
      return res.status(400).json({ success: false, message: "No available products to purchase." });
    }

    // Stock validation
    for (const item of displayItems) {
      const variantObj = item.productId.variants.find(
        v => v._id.toString() === item.variantId.toString()
      ) || (item.productId.variants && item.productId.variants[0]);
      if (!variantObj) {
        return res.status(400).json({ success: false, message: `Variant for product "${item.productId.productName}" not found.` });
      }
      if (variantObj.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.productId.productName} (${variantObj.size}). Only ${variantObj.stock} left.`
        });
      }
    }

    // Calculate total
    const subtotal = displayItems.reduce((acc, item) => acc + item.totalPrice, 0);
    let discount = 0;
    if (req.session && req.session.appliedCoupon) {
      discount = req.session.appliedCoupon.discountAmount || 0;
    }
    const finalTotal = Math.max(0, subtotal - discount);

    // Generate internal order ID for receipt
    const randNum = Math.floor(100000 + Math.random() * 900000);
    const internalOrderId = `NF-2026-${randNum}`;

    // Create Razorpay order
    const razorpayOrder = await paymentService.createOrder(finalTotal, 'INR', internalOrderId);

    // Store pending order data in session for verification step
    req.session.pendingRazorpayOrder = {
      razorpayOrderId: razorpayOrder.id,
      internalOrderId,
      addressId,
      finalTotal,
      subtotal,
      discount,
      isSingleItem,
      productId: productId || '',
      variantId: variantId || ''
    };

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayConfig.key_id,
      internalOrderId
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Failed to initiate payment. Please try again." });
  }
};


/**
 * POST /checkout/verify-payment
 * Verifies Razorpay payment signature, creates DB order if valid.
 */
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification data." });
    }

    // Verify signature
    const isValid = paymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
    }

    // Retrieve pending order data from session
    const pending = req.session.pendingRazorpayOrder;
    if (!pending || pending.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "No matching pending order found. Please try again." });
    }

    const { internalOrderId, addressId, finalTotal, subtotal, discount, isSingleItem, productId, variantId } = pending;

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: "Delivery address not found." });
    }

    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId' });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    let displayItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
    if (isSingleItem && productId && variantId) {
      displayItems = displayItems.filter(
        item => item.productId._id.toString() === productId && item.variantId.toString() === variantId
      );
    }

    if (displayItems.length === 0) {
      return res.status(400).json({ success: false, message: "No available products to purchase." });
    }

    // Decrement stock & build order items
    let orderItems = [];
    for (const item of displayItems) {
      const variantObj = item.productId.variants.find(
        v => v._id.toString() === item.variantId.toString()
      ) || (item.productId.variants && item.productId.variants[0]);
      if (!variantObj) continue;

      variantObj.stock -= item.quantity;
      await item.productId.save();

      orderItems.push({
        productId: item.productId._id,
        variantId: item.variantId,
        productName: item.productId.productName,
        brand: item.productId.brand,
        size: variantObj.size,
        primaryImage: item.productId.primaryImage,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        status: "Pending"
      });
    }

    const shipping = 0;
    const taxes = Math.round(subtotal * 0.18);

    // Create Order with Razorpay payment details
    const newOrder = new Order({
      orderId: internalOrderId,
      userId,
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        addressLine: address.addressLine,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        phone: address.phone
      },
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      subtotal,
      discount,
      shipping,
      taxes,
      finalTotal,
      status: "Pending"
    });

    await newOrder.save();

    // Remove ordered items from cart
    if (isSingleItem && productId && variantId) {
      cart.items = cart.items.filter(
        item => !(item.productId && item.productId._id.toString() === productId && item.variantId.toString() === variantId)
      );
    } else {
      cart.items = [];
    }
    cart.cartTotal = cart.items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
    await cart.save();

    // Clear session data
    delete req.session.pendingRazorpayOrder;
    if (req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }

    res.status(200).json({
      success: true,
      message: "Payment verified & order placed successfully!",
      orderId: internalOrderId,
      finalTotal,
      paymentMethod: "UPI",
      deliveryName: address.fullName,
      deliveryAddress: `${address.addressLine}, ${address.city}, ${address.state} - ${address.postalCode}`
    });

  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({ success: false, message: "Payment verification failed. Please contact support." });
  }
};
