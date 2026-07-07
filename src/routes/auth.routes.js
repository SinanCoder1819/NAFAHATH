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
    verifyOtp,
} from "../controllers/user/auth.controller.js";

import { isLogout, noCache } from '../middlewares/auth.middleware.js';



router.get('/signup',  isLogout, noCache, getSignupPage);
router.post('/signup', registerUserTemp);


router.get('/verify-otp',  noCache, getVerifyOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);


router.get('/login', isLogout, noCache, getLoginPage);
router.post('/login', loginUser , );
router.post('/logout', logoutUser);


router.get('/forgot-password',  isLogout, noCache, getVerifyEmail);
router.post('/forgot-password', sendForgotPasswordOtp);

router.get('/verify-forgotOtp',  noCache, getVerifyForgotOtp);
router.post('/verify-forgotOtp', verifyForgotOtp);
router.post('/resend-forgotOtp', resendForgotOtp);

router.get('/reset-password',  noCache, getResetPassword);
router.post('/reset-password', resetPassword);


router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', noCache, (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error('Google OAuth error:', err);
            return res.redirect('/auth/login?error=google');
        }

        if (!user) {
            const isBlocked = info && info.message === 'Account blocked';
            return res.redirect(isBlocked ? '/auth/login?blocked=true' : '/auth/login?error=google');
        }

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
                res.send(`<!DOCTYPE html><html><body><script>window.location.replace('/');</script></body></html>`);
            });
        });
    })(req, res, next);
});

export default router;
