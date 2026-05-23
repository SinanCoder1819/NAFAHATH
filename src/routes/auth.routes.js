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

// Custom callback so we can distinguish WHY authentication failed.
// passport.authenticate with failureRedirect cannot tell us if the user was
// blocked vs. a generic Google OAuth error — we need to inspect the `info` object.
router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error('Google OAuth error:', err);
            return res.redirect('/auth/login?error=google');
        }

        if (!user) {
            // info.message is set by the strategy when a blocked user tries to log in
            const isBlocked = info && info.message === 'Account blocked';
            return res.redirect(isBlocked ? '/auth/login?blocked=true' : '/auth/login?error=google');
        }

        // Manually call req.login to establish the Passport session,
        // then overwrite session.user with a clean plain-object (same shape as loginUser).
        req.login(user, { session: false }, (loginErr) => {
            if (loginErr) {
                console.error('Google OAuth req.login error:', loginErr);
                return res.redirect('/auth/login?error=google');
            }

            req.session.user = {
                id:    user._id.toString(),
                name:  user.name,
                email: user.email,
            };

            req.session.save((saveErr) => {
                if (saveErr) console.error('Session save error after Google login:', saveErr);
                res.redirect('/');
            });
        });
    })(req, res, next);
});

export default router;
