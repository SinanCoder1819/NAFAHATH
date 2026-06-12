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
  resendCount: {
    type: Number,
    default: 0
  },
  resendBlockedUntil: {
    type: Date,
    default: null
  },
  blockedUntil: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600   
  }
});

export default mongoose.model('OTP', otpSchema);