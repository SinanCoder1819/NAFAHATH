import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true // Ensures fast lookups as your platform grows [cite: 24, 47]
  },
  otpCode: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['SIGNUP', 'FORGOT_PASSWORD'], // Defines the flow [cite: 35, 55]
    required: true
  },
  attempts: {
    type: Number,
    default: 0 // Track failed attempts to prevent brute-force attacks [cite: 57, 66]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // TTL Index: Automatically deletes the doc after 300 seconds (5 mins) [cite: 36, 58]
  }
});


export default mongoose.model('OTP', otpSchema);

