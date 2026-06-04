import express from 'express';
import * as profileController from '../controllers/user/profile.controller.js';
import * as addressController from '../controllers/user/address.controller.js';
import { getHomePage } from '../controllers/user/home.controller.js';
import { upload } from '../config/cloudinary.js';
import { isLogin, checkBlocked } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(checkBlocked);

// Multer error handler wrapper for AJAX routes
const handleUpload = (req, res, next) => {
    upload.single('profileImage')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Image must be under 2MB.' });
            }
            console.error('Multer/Cloudinary error:', err);
            return res.status(400).json({ message: err.message || 'File upload failed.' });
        }
        next();
    });
};

// Public
router.get('/', getHomePage);

// Profile — all protected
router.get('/profile', isLogin, profileController.getProfile);
router.get('/profile/edit', isLogin, profileController.getEditProfile);
router.post('/profile/edit', isLogin, profileController.updateProfile);

// Profile image upload (AJAX)
router.post('/profile/update-image', isLogin, handleUpload, profileController.uploadProfileImage);

// Security Actions
router.get('/profile/change-password', isLogin, profileController.getChangePassword);
router.post('/profile/change-password', isLogin, profileController.changePassword);

// Change Email flow
router.get('/profile/change-email', isLogin, profileController.getChangeEmail);
router.post('/profile/change-email/send-otp', isLogin, profileController.sendChangeEmailOtp);
router.get('/profile/change-email/verify-otp', isLogin, profileController.getVerifyEmailOtp);
router.post('/profile/change-email/verify-otp', isLogin, profileController.verifyChangeEmailOtp);
router.post('/profile/change-email/resend-otp', isLogin, profileController.resendChangeEmailOtp);

// Address — all protected
router.get('/address', isLogin, addressController.getAddressPage);
router.post('/address', isLogin, addressController.addAddress);
router.put('/address/:id', isLogin, addressController.editAddress);
router.delete('/address/:id', isLogin, addressController.deleteAddress);
// Referrals
router.get('/referrals', isLogin, profileController.getReferrals);

export default router;
