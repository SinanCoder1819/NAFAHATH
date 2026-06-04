import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otpCode: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['SIGNUP', 'FORGOT_PASSWORD', 'EMAIL_CHANGE'],
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  // How many times resend has been clicked for this OTP session
  resendCount: {
    type: Number,
    default: 0
  },
  // If resend limit hit, block until this timestamp
  resendBlockedUntil: {
    type: Date,
    default: null
  },
  // If OTP validation fails 5 times, lock verification until this timestamp
  blockedUntil: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600   // MongoDB auto-deletes after 10 minutes
  }
});

export default mongoose.model('OTP', otpSchema);
