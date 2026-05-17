import User from '../../models/User.model.js';
import { cloudinary } from '../../config/cloudinary.js';
import bcrypt from 'bcrypt';
import OTP from '../../models/Otp.model.js';
import { sendOtpEmail } from '../../services/emailService.js';

// Helper to get user ID from session
const getSessionUserId = (req) => req.session.user?.id || req.session.user?._id;

// 1. Get Profile Page
export const getProfile = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const user = await User.findById(userId);

        if (!user) return res.redirect('/auth/login');

        res.render('user/profile', { 
            title: 'My Profile | Nafahath',
            user
        });
    } catch (error) {
        console.error("Profile Load Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

// 2. Get Edit Profile Page
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

// 3. Update Profile Info (name, phone)
export const updateProfile = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { name, phone } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ message: 'Full name is required.' });
        }

        const updateData = { name: name.trim() };
        if (phone !== undefined) updateData.phone = phone.trim() || null;

        await User.findByIdAndUpdate(userId, { $set: updateData });

        // Update session name too
        if (req.session.user) req.session.user.name = name.trim();

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

        // req.file.path is the Cloudinary secure URL when using CloudinaryStorage
        const imageUrl = req.file.path;

        // Delete old image from Cloudinary if it exists
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

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }
        if (!/[A-Z]/.test(newPassword)) {
            return res.status(400).json({ message: 'Password must contain at least one uppercase letter.' });
        }
        if (!/[a-z]/.test(newPassword)) {
            return res.status(400).json({ message: 'Password must contain at least one lowercase letter.' });
        }
        if (!/[0-9]/.test(newPassword)) {
            return res.status(400).json({ message: 'Password must contain at least one number.' });
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
export const getVerifyEmailOtp = (req, res) => {
    if (!req.session.pendingEmail) {
        return res.redirect('/profile/change-email');
    }
    res.render('user/verifyEmailOtp', {
        title: 'Verify New Email | Nafahath',
        newEmail: req.session.pendingEmail
    });
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

        if (!validOtp) {
            return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
        }

        if (validOtp.attempts >= 5) {
            await OTP.deleteOne({ _id: validOtp._id });
            return res.status(403).json({ message: 'Too many failed attempts. Please request a new OTP.' });
        }

        if (validOtp.otpCode !== otp) {
            validOtp.attempts += 1;
            await validOtp.save();
            return res.status(400).json({
                message: `Incorrect OTP. ${5 - validOtp.attempts} attempt(s) left.`
            });
        }

        // OTP correct — update email
        await OTP.deleteOne({ _id: validOtp._id });
        await User.findByIdAndUpdate(userId, { $set: { email: newEmail } });

        // Update session
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
        if (existingOtp && (Date.now() - existingOtp.createdAt < 30 * 1000)) {
            return res.status(429).json({ message: 'Please wait 30 seconds before requesting a new OTP.' });
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.deleteMany({ email: newEmail, purpose: 'EMAIL_CHANGE' });
        await OTP.create({ email: newEmail, otpCode: newOtp, purpose: 'EMAIL_CHANGE' });
        await sendOtpEmail(newEmail, newOtp);

        return res.status(200).json({ message: 'OTP resent successfully.' });
    } catch (error) {
        console.error('Resend change email OTP error:', error);
        return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
};
