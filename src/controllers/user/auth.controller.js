import bcrypt from "bcrypt";
import UnverifiedUser from "../../models/unverifiedUsers.model.js";
import User from "../../models/User.model.js";
import OTP from "../../models/Otp.model.js";
import { sendOtpEmail } from "../../services/emailService.js";

// --- GET PAGES ---

export const getLoginPage = (req, res) => {
  // If already logged in, redirect to home
  if (req.session.user) return res.redirect("/");
  res.render("user/login");
};

export const getSignupPage = (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("user/signup");
};

export const getVerifyOtp = (req, res) => {
  res.render("user/verifyOtp");
};

/**
 * GET Home Page
 * FIXED: Now passes the user session to the view
 */



// --- AUTH LOGIC ---

/**
 * POST /auth/signup
 */

export const registerUserTemp = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    // 1. Basic Validation
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
      console.log("working");
        // 1. Basic validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // 2. Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 3. Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 4. Set Session Data
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
        };


        // 5. THE FIX: Explicitly save session to MongoStore before responding
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);

                return res.status(500).json({ message: "Internal server error" });
            }

    console.log("Session saved:", req.session.user);     
    console.log("Session ID:", req.session.id);
            // 6. Only now tell the frontend it's okay to redirect
            return res.status(200).json({
                message: "Login successful!",
                redirectUrl: "/", 
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
    res.clearCookie("connect.sid"); // Matches default express-session cookie name
    res.redirect("/");
  });
};


export const getVerifyEmail = (req, res) => {
    res.render('user/forgot-password', { 
        title: 'Verify Your Email | Nafahath',
        // email: req.session.tempEmail // Assume email is stored during signup
    });
};


export const sendForgotPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
        
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "The email account not exists." });
        }


        const otp = Math.floor(100000 + Math.random() * 900000).toString();

 
        user.otp = otp;
       
        user.otpExpire = Date.now() + 10 * 60 * 1000; 
        await user.save();

   
        await sendOtpEmail(email, otp);

        
        req.session.forgotEmail = email;

        return res.status(200).json({ message: "OTP send to your email." });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};




export const verifyForgotOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.forgotEmail;

        if (!email) {
            return res.status(400).json({ message: "Session is expired." });
        }

        const user = await User.findOne({ email });

     
        if (!user || user.otp !== otp || user.otpExpire < Date.now()) {
            return res.status(400).json({ message: "Incorrect OTP or expired" });
        }

        return res.status(200).json({ message: "OTP verification completed" });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
}

