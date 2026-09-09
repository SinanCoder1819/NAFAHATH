// src/services/payment.service.js
import Razorpay from 'razorpay';
import crypto from 'crypto';
import razorpayConfig from '../config/payment.js';

const instance = new Razorpay({
  key_id: razorpayConfig.key_id,
  key_secret: razorpayConfig.key_secret,
});

/**
 * Create a Razorpay order
 * @param {number} amount - Amount in INR (rupees, not paise)
 * @param {string} currency - Currency code (default: INR)
 * @param {string} receipt - Optional receipt identifier
 * @returns {Promise<Object>} Razorpay order object
 */
export const createOrder = async (amount, currency = 'INR', receipt = null) => {
  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
    payment_capture: 1, // Auto-capture payment
  };
  return await instance.orders.create(options);
};

/**
 * Verify Razorpay payment signature using HMAC SHA256
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} razorpaySignature - Razorpay signature from callback
 * @returns {boolean} true if signature is valid
 */
export const verifySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', razorpayConfig.key_secret)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpaySignature;
};

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
export const fetchPayment = async (paymentId) => {
  return await instance.payments.fetch(paymentId);
};

/**
 * Fetch recent orders from Razorpay
 * @param {number} limit - Max orders to fetch
 * @returns {Promise<Object>} Orders list
 */
export const fetchTransactions = async (limit = 10) => {
  return await instance.orders.all({ count: limit, skip: 0 });
};
