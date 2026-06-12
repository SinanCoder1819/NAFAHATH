import User from '../../models/User.model.js';
import { cloudinary } from '../../config/cloudinary.js';
import bcrypt from 'bcrypt';
import OTP from '../../models/Otp.model.js';
import { sendOtpEmail } from '../../services/emailService.js';
import { validateName, validatePhone, validatePassword } from '../../utils/validators.js';
import { generateUniqueReferralCode } from '../../utils/referral.js';

// Helper to get user ID from session
const getSessionUserId = (req) => req.session.user?.id || req.session.user?._id;


export const getProfile = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const user = await User.findById(userId);

        if (!user) return res.redirect('/auth/login');

        res.render('user/profile', { 
            title: 'My Profile | Nafahath',
            user,
            isGoogleUser: !!user.googleId
        });
    } catch (error) {
        console.error("Profile Load Error:", error);
        res.status(500).send("Internal Server Error");
    }
};



export const blockGoogleUser = async (req, res, next) => {
    const userId = getSessionUserId(req);
    const user = await User.findById(userId);
    if (user?.googleId) return res.redirect('/profile');
    next();
};


export const getEditProfile = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const user = await User.findById(userId);

        if (!user) return res.redirect('/auth/login');

        res.render('user/editProfile', { 
            title: 'Edit Profile | Nafahath',
            user 
        });
    } catch (error) {
        console.error("Edit Page Load Error:", error);
        res.redirect('/profile');
    }
};


export const updateProfile = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { name, phone } = req.body;

        // Name validation (required)
        const nameCheck = validateName(name);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.message });
        }


        const updateData = { name: nameCheck.value };

        // Phone is optional on profile edit — validate only when provided and non-empty
        if (phone !== undefined && phone.trim() !== '') {
            const phoneCheck = validatePhone(phone);
            if (!phoneCheck.valid) {
                return res.status(400).json({ message: phoneCheck.message });
            }
            updateData.phone = phoneCheck.value;
        } else if (phone !== undefined) {
            // Empty string submitted — clear phone
            updateData.phone = null;
        }

        await User.findByIdAndUpdate(userId, { $set: updateData });

        if (req.session.user) req.session.user.name = nameCheck.value;

        return res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error("Update error:", error);
        return res.status(500).json({ message: 'Profile update failed.' });
    }
};

// 4. Upload Profile Image (AJAX)
export const uploadProfileImage = async (req, res) => {
    try {
        const userId = getSessionUserId(req);

        if (!userId) {
            return res.status(401).json({ message: "Not authenticated. Please log in." });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No image file provided." });
        }

        
        const imageUrl = req.file.path;

      
        const user = await User.findById(userId);
        if (user?.profileImage) {
            try {
                const urlParts = user.profileImage.split('/');
                const fileWithExt = urlParts[urlParts.length - 1];
                const publicId = `Nafahath_User_Profiles/${fileWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.warn("Old image deletion failed:", err.message);
            }
        }

        await User.findByIdAndUpdate(userId, { $set: { profileImage: imageUrl } });

        return res.status(200).json({ 
            message: "Profile image updated successfully.",
            newImageUrl: imageUrl
        });
    } catch (error) {
        console.error("Image upload error:", error);
        return res.status(500).json({ message: "Image upload failed. Please try again." });
    }
};

// 5. Get Change Password Page
export const getChangePassword = (req, res) => {
    res.render('user/changePassword', { title: 'Change Password | Nafahath' });
};

// 6. Change Password (AJAX)
export const changePassword = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.valid) {
            return res.status(400).json({ message: passwordCheck.message });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Google OAuth users may not have a password
        if (!user.password) {
            return res.status(400).json({ message: 'Your account uses Google login. Password change is not available.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ message: 'New password must be different from current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } });

        return res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: 'Failed to change password.' });
    }
};

// 7. Get Change Email Page
export const getChangeEmail = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const user = await User.findById(userId);
        if (!user) return res.redirect('/auth/login');
        res.render('user/changeEmail', { title: 'Change Email | Nafahath', user });
    } catch (error) {
        res.redirect('/profile');
    }
};

// 8. Send OTP to new email
export const sendChangeEmailOtp = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { newEmail } = req.body;

        if (!newEmail) {
            return res.status(400).json({ message: 'New email is required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        const currentUser = await User.findById(userId);
        if (newEmail.toLowerCase() === currentUser.email.toLowerCase()) {
            return res.status(400).json({ message: 'New email must be different from your current email.' });
        }

        // Check if new email is already taken
        const existing = await User.findOne({ email: newEmail.toLowerCase() });
        if (existing) {
            return res.status(409).json({ message: 'This email is already in use by another account.' });
        }

        const existingOtp = await OTP.findOne({ email: newEmail.toLowerCase(), purpose: 'EMAIL_CHANGE' });
        if (existingOtp && existingOtp.blockedUntil && existingOtp.blockedUntil > new Date()) {
            const timeLeftMs = existingOtp.blockedUntil.getTime() - Date.now();
            const minutesLeft = Math.ceil(timeLeftMs / 60000);
            return res.status(403).json({
                message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
                blockedUntil: existingOtp.blockedUntil.getTime()
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.deleteMany({ email: newEmail.toLowerCase(), purpose: 'EMAIL_CHANGE' });
        await OTP.create({ email: newEmail.toLowerCase(), otpCode: otp, purpose: 'EMAIL_CHANGE' });

        await sendOtpEmail(newEmail, otp);

        // Store new email in session temporarily
        req.session.pendingEmail = newEmail.toLowerCase();

        return res.status(200).json({ message: 'OTP sent to your new email.' });
    } catch (error) {
        console.error('Send change email OTP error:', error);
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
};

// 9. Get Verify Email OTP Page
export const getVerifyEmailOtp = async (req, res) => {
    try {
        const newEmail = req.session.pendingEmail;
        if (!newEmail) {
            return res.redirect('/profile/change-email');
        }
        const otp = await OTP.findOne({ email: newEmail, purpose: 'EMAIL_CHANGE' });
        let timeLeft = 30;
        if (otp) {
            if (otp.blockedUntil && otp.blockedUntil > new Date()) {
                timeLeft = Math.max(0, Math.ceil((otp.blockedUntil.getTime() - Date.now()) / 1000));
            } else {
                const elapsed = Math.round((Date.now() - otp.createdAt.getTime()) / 1000);
                timeLeft = Math.max(0, 30 - elapsed);
            }
        }
        res.render('user/verifyEmailOtp', {
            title: 'Verify New Email | Nafahath',
            newEmail,
            timeLeft
        });
    } catch (err) {
        console.error("Error loading verify email OTP page:", err);
        res.redirect('/profile/change-email');
    }
};

// 10. Verify OTP and update email
export const verifyChangeEmailOtp = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { otp } = req.body;
        const newEmail = req.session.pendingEmail;

        if (!newEmail) {
            return res.status(400).json({ message: 'Session expired. Please start again.' });
        }

        if (!otp || otp.length !== 6) {
            return res.status(400).json({ message: 'Please enter a valid 6-digit OTP.' });
        }

        const validOtp = await OTP.findOne({ email: newEmail, purpose: 'EMAIL_CHANGE' });

        if (validOtp && validOtp.blockedUntil && validOtp.blockedUntil > new Date()) {
            const timeLeftMs = validOtp.blockedUntil.getTime() - Date.now();
            const minutesLeft = Math.ceil(timeLeftMs / 60000);
            return res.status(403).json({
                message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
                blockedUntil: validOtp.blockedUntil.getTime()
            });
        }

        if (!validOtp) {
            return res.status(400).json({ message: 'OTP expired.' });
        }

        if (Date.now() - validOtp.createdAt.getTime() > 30 * 1000) {
            await OTP.deleteOne({ _id: validOtp._id });
            return res.status(400).json({ message: 'OTP expired.' });
        }

        if (validOtp.otpCode !== otp) {
            validOtp.attempts += 1;
            if (validOtp.attempts >= 5) {
                validOtp.blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
                await validOtp.save();
                return res.status(403).json({
                    message: 'Too many failed attempts. OTP verification is locked for 5 minutes.',
                    blockedUntil: validOtp.blockedUntil.getTime()
                });
            }
            await validOtp.save();
            return res.status(400).json({
                message: 'Incorrect OTP.'
            });
        }

        await OTP.deleteOne({ _id: validOtp._id });
        await User.findByIdAndUpdate(userId, { $set: { email: newEmail } });

        if (req.session.user) req.session.user.email = newEmail;
        req.session.pendingEmail = null;

        return res.status(200).json({ message: 'Email updated successfully.' });
    } catch (error) {
        console.error('Verify change email OTP error:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
};

// 11. Resend OTP for email change
export const resendChangeEmailOtp = async (req, res) => {
    try {
        const newEmail = req.session.pendingEmail;

        if (!newEmail) {
            return res.status(400).json({ message: 'Session expired. Please start again.' });
        }

        const existingOtp = await OTP.findOne({ email: newEmail, purpose: 'EMAIL_CHANGE' });
        const now = Date.now();

        if (existingOtp && existingOtp.blockedUntil) {
            if (existingOtp.blockedUntil > new Date()) {
                const timeLeftMs = existingOtp.blockedUntil.getTime() - now;
                const minutesLeft = Math.ceil(timeLeftMs / 60000);
                return res.status(403).json({
                    message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
                    blockedUntil: existingOtp.blockedUntil.getTime()
                });
            } else {
                // Cooldown completed -> reset resendCount and attempts
                existingOtp.blockedUntil = null;
                existingOtp.resendCount = 0;
                existingOtp.attempts = 0;
                await existingOtp.save();
            }
        }

        // 30-second cooldown
        if (existingOtp && (now - existingOtp.createdAt < 30 * 1000)) {
            return res.status(429).json({ message: 'Please wait 30 seconds before requesting a new OTP.' });
        }

        const newResendCount = (existingOtp?.resendCount || 0) + 1;

        if (newResendCount >= 5) {
            const blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
            await OTP.deleteMany({ email: newEmail, purpose: 'EMAIL_CHANGE' });
            await OTP.create({
                email: newEmail,
                otpCode: "DISABLED",
                purpose: 'EMAIL_CHANGE',
                resendCount: newResendCount,
                attempts: 0,
                blockedUntil: blockedUntil,
            });

            return res.status(403).json({
                message: "Maximum resend attempts reached. OTP verification is locked for 5 minutes.",
                blockedUntil: blockedUntil.getTime(),
            });
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

        const currentAttempts = existingOtp?.attempts || 0;
        const currentBlockedUntil = existingOtp?.blockedUntil || null;

        await OTP.deleteMany({ email: newEmail, purpose: 'EMAIL_CHANGE' });

        await OTP.create({
            email: newEmail,
            otpCode: newOtp,
            purpose: 'EMAIL_CHANGE',
            resendCount: newResendCount,
            attempts: currentAttempts,
            blockedUntil: currentBlockedUntil,
        });

        await sendOtpEmail(newEmail, newOtp);

        return res.status(200).json({
            message: 'OTP resent successfully.',
            resendCount: newResendCount,
        });
    } catch (error) {
        console.error('Resend change email OTP error:', error);
        return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
};

// 12. Get Referrals Page
export const getReferrals = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        let user = await User.findById(userId);

        if (!user) return res.redirect('/auth/login');

        // Self-healing fallback for legacy users without a code
        if (!user.referralCode) {
            const referralCode = await generateUniqueReferralCode();
            user = await User.findByIdAndUpdate(userId, { $set: { referralCode } }, { new: true });
        }

        const referredUsers = await User.find({ referredBy: userId }).select("name email createdAt");

        res.render('user/referrals', {
            title: 'Refer & Earn | Nafahath',
            user,
            referredUsers
        });
    } catch (error) {
        console.error("Referrals Load Error:", error);
        res.status(500).send("Internal Server Error");
    }
};
