import bcrypt from "bcrypt";
import UnverifiedUser from "../../models/unverifiedUsers.model.js";
import User from "../../models/User.model.js";
import OTP from "../../models/Otp.model.js";
import { sendOtpEmail } from "../../services/emailService.js";

// --- GET PAGES ---

export const getLoginPage = (req, res) => {
  if (req.session.user) return res.redirect("/");
  const blocked = req.query.blocked === 'true';
  res.render("user/login", { blocked });
};

export const getSignupPage = (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("user/signup");
};

export const getVerifyOtp = (req, res) => {
  res.render("user/verifyOtp");
};



export const registerUserTemp = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

  
    if (!name || !email || !password || !confirmPassword || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // 2. Check if user already exists in permanent collection
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    // 3. Prepare User Data
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 4. Handle OTP Generation & Storage
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Best Practice: Clear any existing signup OTPs for this email first
    await OTP.deleteMany({ email, purpose: "SIGNUP" });

    // Store OTP in the dedicated collection
    await OTP.create({
      email,
      otpCode: otp,
      purpose: "SIGNUP"
    });

    // 5. Upsert unverified user data (WITHOUT the OTP)
    const tempUser = await UnverifiedUser.findOneAndUpdate(
      { email },
      { name, email, password: hashedPassword, phone, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // 6. Send Email and handle session
    try {
      await sendOtpEmail(email, otp);
      
      // Store email in session instead of userId for more flexible lookups
      req.session.email = email; 

      return res.status(201).json({
        message: "OTP sent to email.",
        email: tempUser.email, // Passing email back to frontend is often more useful
      });
    } catch (emailError) {
      // Cleanup if email fails
      await UnverifiedUser.deleteOne({ email });
      await OTP.deleteOne({ email, otpCode: otp });
      return res.status(500).json({ message: "Failed to send OTP." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /auth/verify-otp
 */
export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.session.email;

    // 1. Session check first
    if (!email) {
      return res.status(400).json({ message: "Session expired. Please signup again." });
    }

    const validOtp = await OTP.findOne({ 
      email: email, 
      purpose: "SIGNUP" 
    });

    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // 2. Check and increment attempts
    if (validOtp.attempts >= 5) {
      await OTP.deleteOne({ _id: validOtp._id }); // Block this specific OTP
      return res.status(403).json({ message: "Too many failed attempts. Please request a new OTP." });
    }

    if (validOtp.otpCode !== otp) {
      validOtp.attempts += 1;
      await validOtp.save(); // CRITICAL: Save the new attempt count to DB
      return res.status(400).json({ 
        message: `Incorrect OTP. ${5 - validOtp.attempts} attempts left.` 
      });
    }

    // 3. Find temporary user data
    const tempUser = await UnverifiedUser.findOne({ email: email });
    if (!tempUser) {
      return res.status(400).json({ message: "Registration data not found. Please signup again." });
    }

    // 4. Create permanent User
    await User.create({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      phone: tempUser.phone,
    });

    // 5. Cleanup
    await UnverifiedUser.deleteOne({ email: email });
    await OTP.deleteOne({ _id: validOtp._id });
    
    // Clear session data
    req.session.email = null; 

    return res.status(200).json({
      message: "Account verified successfully",
      redirectUrl: "/auth/login",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resendOtp = async (req, res) => {
  try {
    // Use email from session (assigned during registerUserTemp)
    const email = req.session.email;

    if (!email) {
      return res.status(400).json({
        message: "Session expired. Please signup again.",
      });
    }

    // 1. Verify the user still exists in the temporary collection
    const user = await UnverifiedUser.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "No pending signup found. Please signup again.",
      });
    }

    // 2. Cooldown check using the OTPs collection
    const existingOtp = await OTP.findOne({ email, purpose: "SIGNUP" });
    const now = Date.now();

    if (existingOtp && (now - existingOtp.createdAt < 30 * 1000)) {
      return res.status(429).json({
        message: "Please wait 30 seconds before requesting a new OTP.",
      });
    }

    // 3. Generate and Save new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any old signup OTPs for this email [cite: 48, 118]
    await OTP.deleteMany({ email, purpose: "SIGNUP" });

    // Create the new OTP record [cite: 51, 117]
    await OTP.create({
      email,
      otpCode: newOtp,
      purpose: "SIGNUP"
    });

    // 4. Send email [cite: 109]
    await sendOtpEmail(email, newOtp);

    return res.status(200).json({
      message: "OTP resent successfully",
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      message: "Failed to resend OTP",
    });
  }
};

/**
 * POST /auth/login
 * FIXED: Now properly initializes the session
 */
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Block check
        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
        }

        // Google-only accounts have no password
        if (!user.password) {
            return res.status(401).json({ message: "This account uses Google login. Please sign in with Google." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
        };

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ message: "Internal server error" });
            }

            // Redirect to the page they were trying to visit, or home
            const returnTo = req.session.returnTo || '/';
            delete req.session.returnTo;

            return res.status(200).json({
                message: "Login successful!",
                redirectUrl: returnTo,
            });
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
/**
 * GET /auth/logout
 */
export const logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.redirect("/");
        res.clearCookie("user.sid");
        res.redirect("/auth/login");
    });
};


export const getVerifyEmail = (req, res) => {
    res.render('user/forgot-password', { 
        title: 'Forgot Password | Nafahath',
    });
};


export const sendForgotPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "No account found with this email." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Clear any existing forgot-password OTPs for this email
        await OTP.deleteMany({ email, purpose: "FORGOT_PASSWORD" });

        // Store OTP in dedicated collection
        await OTP.create({
            email,
            otpCode: otp,
            purpose: "FORGOT_PASSWORD"
        });

        await sendOtpEmail(email, otp);

        req.session.forgotEmail = email;

        return res.status(200).json({ message: "OTP sent to your email." });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};


// GET /auth/verify-forgotOtp
export const getVerifyForgotOtp = (req, res) => {
    if (!req.session.forgotEmail) {
        return res.redirect('/auth/forgot-password');
    }
    res.render('user/verify-forgotOtp', { 
        title: 'Verify OTP | Nafahath',
    });
};


export const verifyForgotOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.forgotEmail;

        if (!email) {
            return res.status(400).json({ message: "Session expired. Please start again." });
        }

        if (!otp || otp.length !== 6) {
            return res.status(400).json({ message: "Please enter a valid 6-digit OTP." });
        }

        const validOtp = await OTP.findOne({ email, purpose: "FORGOT_PASSWORD" });

        if (!validOtp) {
            return res.status(400).json({ message: "OTP expired or not found. Please request a new one." });
        }

        if (validOtp.attempts >= 5) {
            await OTP.deleteOne({ _id: validOtp._id });
            return res.status(403).json({ message: "Too many failed attempts. Please request a new OTP." });
        }

        if (validOtp.otpCode !== otp) {
            validOtp.attempts += 1;
            await validOtp.save();
            return res.status(400).json({ 
                message: `Incorrect OTP. ${5 - validOtp.attempts} attempt(s) left.` 
            });
        }

        // OTP is correct — mark session as verified, clean up OTP
        await OTP.deleteOne({ _id: validOtp._id });
        req.session.otpVerified = true;

        return res.status(200).json({ message: "OTP verified successfully." });
    } catch (error) {
        console.error("Verify forgot OTP error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};


export const resendForgotOtp = async (req, res) => {
    try {
        const email = req.session.forgotEmail;

        if (!email) {
            return res.status(400).json({ message: "Session expired. Please start again." });
        }

        // Cooldown check
        const existingOtp = await OTP.findOne({ email, purpose: "FORGOT_PASSWORD" });
        if (existingOtp && (Date.now() - existingOtp.createdAt < 30 * 1000)) {
            return res.status(429).json({ message: "Please wait 30 seconds before requesting a new OTP." });
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.deleteMany({ email, purpose: "FORGOT_PASSWORD" });
        await OTP.create({ email, otpCode: newOtp, purpose: "FORGOT_PASSWORD" });

        await sendOtpEmail(email, newOtp);

        return res.status(200).json({ message: "OTP resent successfully." });
    } catch (error) {
        console.error("Resend forgot OTP error:", error);
        return res.status(500).json({ message: "Failed to resend OTP." });
    }
};


// GET /auth/reset-password
export const getResetPassword = (req, res) => {
    if (!req.session.forgotEmail || !req.session.otpVerified) {
        return res.redirect('/auth/forgot-password');
    }
    res.render('user/reset-password', { title: 'Reset Password | Nafahath' });
};


// POST /auth/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const email = req.session.forgotEmail;

        if (!email || !req.session.otpVerified) {
            return res.status(403).json({ message: "Unauthorized. Please verify your OTP first." });
        }

        if (!password || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters." });
        }

        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ message: "Password must contain at least one uppercase letter." });
        }

        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ message: "Password must contain at least one number." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        // Clear session flags
        req.session.forgotEmail = null;
        req.session.otpVerified = null;

        return res.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

