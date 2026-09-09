import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true
  },
  primaryImage: {
    type: String,
    default: ""
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned"],
    default: "Pending"
  },
  cancellationReason: {
    type: String,
    default: ""
  },
  cancellationComments: {
    type: String,
    default: ""
  },
  returnReason: {
    type: String,
    default: ""
  },
  returnComments: {
    type: String,
    default: ""
  }
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  items: [orderItemSchema],
  shippingAddress: {
    fullName: { type: String, required: true },
    addressLine: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true }
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed", "Refunded"],
    default: "Pending"
  },
  razorpayOrderId: {
    type: String,
    default: ""
  },
  razorpayPaymentId: {
    type: String,
    default: ""
  },
  razorpaySignature: {
    type: String,
    default: ""
  },
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  taxes: {
    type: Number,
    default: 0
  },
  finalTotal: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Return Requested"],
    default: "Pending"
  },
  cancellationReason: {
    type: String,
    default: ""
  },
  cancellationComments: {
    type: String,
    default: ""
  },
  returnReason: {
    type: String,
    default: ""
  },
  returnComments: {
    type: String,
    default: ""
  },
  returnPickupMethod: {
    type: String,
    default: "Pick up from my address"
  },
  returnPickupDate: {
    type: Date
  },
  returnImages: [{
    type: String
  }],
  returnStatus: {
    type: String,
    enum: ["Return Requested", "Pick Up Scheduled", "Picked Up", "Under Review", "Refund Initiated", "Refund Completed", "Completed", "None"],
    default: "None"
  },
  returnTimeline: {
    requestedAt: { type: Date },
    pickupScheduledAt: { type: Date },
    pickedUpAt: { type: Date },
    underReviewAt: { type: Date },
    refundInitiatedAt: { type: Date },
    refundCompletedAt: { type: Date }
  }
}, {
  timestamps: true
});

export default mongoose.model("Order", orderSchema);
