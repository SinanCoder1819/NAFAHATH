import express from 'express'
const router = express.Router();
import { getLoginPage, getSignupPage, getVerifyEmail, getVerifyOtp, loginUser, logoutUser, registerUserTemp, resendOtp, sendForgotPasswordOtp, verifyForgotOtp, verifyOtp } from "../controllers/user/auth.controller.js"

router.get('/login', getLoginPage);
router.get('/signup', getSignupPage);
router.post('/signup', registerUserTemp);
router.get('/verify-otp', getVerifyOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp',resendOtp);
router.post('/login', loginUser);
router.get('/logout', logoutUser);
router.get('/forgot-password',getVerifyEmail)
router.post('/forgot-password',sendForgotPasswordOtp)
router.post('/verify-forgot-otp',verifyForgotOtp);


export default router;