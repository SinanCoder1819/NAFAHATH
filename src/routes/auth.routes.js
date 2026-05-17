import express from 'express';
import passport from 'passport';
const router = express.Router();
import {
    getLoginPage,
    getSignupPage,
    getVerifyEmail,
    getVerifyOtp,
    loginUser,
    logoutUser,
    registerUserTemp,
    resendOtp,
    sendForgotPasswordOtp,
    verifyForgotOtp,
    getVerifyForgotOtp,
    resendForgotOtp,
    getResetPassword,
    resetPassword,
    verifyOtp
} from "../controllers/user/auth.controller.js";
import { isLogout } from '../middlewares/auth.middleware.js';

// Signup flow — guests only
router.get('/signup', isLogout, getSignupPage);
router.post('/signup', registerUserTemp);
router.get('/verify-otp', getVerifyOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Login / Logout
router.get('/login', isLogout, getLoginPage);
router.post('/login', loginUser);
router.get('/logout', logoutUser);

// Forgot password flow — guests only
router.get('/forgot-password', isLogout, getVerifyEmail);
router.post('/forgot-password', sendForgotPasswordOtp);
router.get('/verify-forgotOtp', getVerifyForgotOtp);   // has its own session guard inside controller
router.post('/verify-forgotOtp', verifyForgotOtp);
router.post('/resend-forgotOtp', resendForgotOtp);
router.get('/reset-password', getResetPassword);        // has its own session guard inside controller
router.post('/reset-password', resetPassword);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => {
        req.session.user = req.user;
        res.redirect('/');
    }
);

export default router;
