import bcrypt from "bcrypt";
import UnverifiedUser from "../../models/unverifiedUsers.model.js";
import User from "../../models/User.model.js";
import OTP from "../../models/Otp.model.js";
import { sendOtpEmail } from "../../services/emailService.js";
import { validateName, validatePhone, validatePassword } from "../../utils/validators.js";
import { generateUniqueReferralCode } from "../../utils/referral.js";



export const getSignupPage = (req, res) => {
  res.render("user/signup");
};


export const registerUserTemp = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, referral } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

   
    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
      return res.status(400).json({ message: nameCheck.message });
    }


    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (referral && referral.trim() !== "") {
      const referrer = await User.findOne({ referralCode: referral.trim() });
      if (!referrer) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const existingOtp = await OTP.findOne({ email, purpose: "SIGNUP" });
    if (existingOtp && existingOtp.blockedUntil && existingOtp.blockedUntil > new Date()) {
      const timeLeftMs = existingOtp.blockedUntil.getTime() - Date.now();
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: existingOtp.blockedUntil.getTime()
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email, purpose: "SIGNUP" });
    await OTP.create({ email, otpCode: otp, purpose: "SIGNUP" });

    const tempUser = await UnverifiedUser.findOneAndUpdate(
      { email },
      {
        name: nameCheck.value,
        email,
        password: hashedPassword,
        phone: phoneCheck.value,
        referral,
        createdAt: Date.now(),
      },
      { upsert: true, returnDocument: "after" },
    );

    try {
      await sendOtpEmail(email, otp);
      req.session.email = email;
      return res
        .status(201)
        .json({ message: "OTP sent to email.", email: tempUser.email });
    } catch (emailError) {
      await UnverifiedUser.deleteOne({ email });
      await OTP.deleteOne({ email, otpCode: otp });
      return res.status(500).json({ message: "Failed to send OTP." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getVerifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.redirect("/auth/signup");
    }
    const otp = await OTP.findOne({ email, purpose: "SIGNUP" });
    let timeLeft = 30;
    if (otp) {
      if (otp.blockedUntil && otp.blockedUntil > new Date()) {
        timeLeft = Math.max(0, Math.ceil((otp.blockedUntil.getTime() - Date.now()) / 1000));
      } else {
        const elapsed = Math.round((Date.now() - otp.createdAt.getTime()) / 1000);
        timeLeft = Math.max(0, 30 - elapsed);
      }
    }
    res.render("user/verifyOtp", { timeLeft });
  } catch (err) {
    console.error("Error loading verify OTP page:", err);
    res.redirect("/auth/signup");
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.session.email;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Session expired. Please signup again." });
    }

    const validOtp = await OTP.findOne({ email, purpose: "SIGNUP" });

    if (validOtp && validOtp.blockedUntil && validOtp.blockedUntil > new Date()) {
      const timeLeftMs = validOtp.blockedUntil.getTime() - Date.now();
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: validOtp.blockedUntil.getTime()
      });
    }

    if (!validOtp) {
      return res
        .status(400)
        .json({ message: "OTP expired." });
    }

    if (Date.now() - validOtp.createdAt.getTime() > 30 * 1000) {
      await OTP.deleteOne({ _id: validOtp._id });
      return res.status(400).json({ message: "OTP expired." });
    }

    if (validOtp.otpCode !== otp) {
      validOtp.attempts += 1;
      if (validOtp.attempts >= 5) {
        validOtp.blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        await validOtp.save();
        return res.status(403).json({
          message: "Too many failed attempts. OTP verification is locked for 5 minutes.",
          blockedUntil: validOtp.blockedUntil.getTime()
        });
      }
      await validOtp.save();
      return res
        .status(400)
        .json({
          message: "Incorrect OTP.",
        });
    }

    const tempUser = await UnverifiedUser.findOne({ email });
    if (!tempUser) {
      return res
        .status(400)
        .json({ message: "Registration data not found. Please signup again." });
    }

    let referrerId = undefined;
    if (tempUser.referral && tempUser.referral.trim() !== "") {
      const referrer = await User.findOne({ referralCode: tempUser.referral.trim() });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    const selfReferralCode = await generateUniqueReferralCode();

    await User.create({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      phone: tempUser.phone,
      referralCode: selfReferralCode,
      referredBy: referrerId
    });

    await UnverifiedUser.deleteOne({ email });
    await OTP.deleteOne({ _id: validOtp._id });
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
    const email = req.session.email;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Session expired. Please signup again." });
    }

    const user = await UnverifiedUser.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No pending signup found. Please signup again." });
    }

    const existingOtp = await OTP.findOne({ email, purpose: "SIGNUP" });
    const now = Date.now();

    if (existingOtp && existingOtp.blockedUntil && existingOtp.blockedUntil > new Date()) {
      const timeLeftMs = existingOtp.blockedUntil.getTime() - now;
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: existingOtp.blockedUntil.getTime()
      }); 
    }

    // ── 30-second cooldown between individual resends ────────────────
    if (existingOtp && now - existingOtp.createdAt.getTime() < 30 * 1000) {
      const secsLeft = Math.ceil(
        30 - (now - existingOtp.createdAt.getTime()) / 1000,
      );
      return res.status(429).json({
        message: `Please wait ${secsLeft} second(s) before requesting a new OTP.`,
      });
    }

    const currentResendCount = existingOtp?.resendCount || 0;
    const newResendCount = currentResendCount + 1;

    if (newResendCount >= 5) {
      const blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      await OTP.deleteMany({ email, purpose: "SIGNUP" });
      await OTP.create({
        email,
        otpCode: "DISABLED",
        purpose: "SIGNUP",
        resendCount: newResendCount,
        attempts: 0,
        blockedUntil: blockedUntil,
      });

      return res.status(403).json({
        message: "Maximum resend attempts reached. OTP verification is locked for 5 minutes.",
        blockedUntil: blockedUntil.getTime(),
      });
    }

    // ── Generate and send new OTP ────────────────────────────────────
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const currentAttempts = existingOtp?.attempts || 0;
    const currentBlockedUntil = existingOtp?.blockedUntil || null;

    await OTP.deleteMany({ email, purpose: "SIGNUP" });
    await OTP.create({
      email,
      otpCode: newOtp,
      purpose: "SIGNUP",
      resendCount: newResendCount,
      attempts: currentAttempts,
      blockedUntil: currentBlockedUntil,
    });

    await sendOtpEmail(email, newOtp);

    return res.status(200).json({
      message: "OTP resent successfully.",
      resendCount: newResendCount,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Failed to resend OTP." });
  }
};




export const getLoginPage = (req, res) => {
  const blocked = req.query.blocked === "true";
  const googleError = req.query.error === "google";
  res.render("user/login", { blocked, googleError });
};


export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked. Please contact support.",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google login. Please sign in with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

  
    req.session.user = {
      id: user._id.toString(), 
      name:  user.name,
      email: user.email,
    };

 
    const returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
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




export const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.redirect("/");
    res.clearCookie("user.sid");
    res.redirect("/auth/login");
  });
};

export const getVerifyEmail = (req, res) => {
  res.render("user/forgot-password", {
    title: "Forgot Password | Nafahath",
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
      return res
        .status(404)
        .json({ message: "No account found with this email." });
    }

    const existingOtp = await OTP.findOne({ email, purpose: "FORGOT_PASSWORD" });
    if (existingOtp && existingOtp.blockedUntil && existingOtp.blockedUntil > new Date()) {
      const timeLeftMs = existingOtp.blockedUntil.getTime() - Date.now();
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: existingOtp.blockedUntil.getTime()
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Clear any existing forgot-password OTPs for this email
    await OTP.deleteMany({ email, purpose: "FORGOT_PASSWORD" });

    // Store OTP in dedicated collection
    await OTP.create({
      email,
      otpCode: otp,
      purpose: "FORGOT_PASSWORD",
    });

    await sendOtpEmail(email, otp);

    req.session.forgotEmail = email;

    return res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getVerifyForgotOtp = async (req, res) => {
  try {
    const email = req.session.forgotEmail;
    if (!email) {
      return res.redirect("/auth/forgot-password");
    }
    const otp = await OTP.findOne({ email, purpose: "FORGOT_PASSWORD" });
    let timeLeft = 30;
    if (otp) {
      if (otp.blockedUntil && otp.blockedUntil > new Date()) {
        timeLeft = Math.max(0, Math.ceil((otp.blockedUntil.getTime() - Date.now()) / 1000));
      } else {
        const elapsed = Math.round((Date.now() - otp.createdAt.getTime()) / 1000);
        timeLeft = Math.max(0, 30 - elapsed);
      }
    }
    res.render("user/verify-forgotOtp", {
      title: "Verify OTP | Nafahath",
      timeLeft
    });
  } catch (err) {
    console.error("Error loading verify forgot OTP page:", err);
    res.redirect("/auth/forgot-password");
  }
};

export const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.session.forgotEmail;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Session expired. Please start again." });
    }

    if (!otp || otp.length !== 6) {
      return res
        .status(400)
        .json({ message: "Please enter a valid 6-digit OTP." });
    }

    const validOtp = await OTP.findOne({ email, purpose: "FORGOT_PASSWORD" });

    if (validOtp && validOtp.blockedUntil && validOtp.blockedUntil > new Date()) {
      const timeLeftMs = validOtp.blockedUntil.getTime() - Date.now();
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: validOtp.blockedUntil.getTime()
      });
    }

    if (!validOtp) {
      return res
        .status(400)
        .json({ message: "OTP expired." });
    }

    if (Date.now() - validOtp.createdAt.getTime() > 30 * 1000) {
      await OTP.deleteOne({ _id: validOtp._id });
      return res.status(400).json({ message: "OTP expired." });
    }

    if (validOtp.otpCode !== otp) {
      validOtp.attempts += 1;
      if (validOtp.attempts >= 5) {
        validOtp.blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        await validOtp.save();
        return res.status(403).json({
          message: "Too many failed attempts. OTP verification is locked for 5 minutes.",
          blockedUntil: validOtp.blockedUntil.getTime()
        });
      }
      await validOtp.save();
      return res.status(400).json({
        message: "Incorrect OTP.",
      });
    }

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
      return res
        .status(400)
        .json({ message: "Session expired. Please start again." });
    }

    const existingOtp = await OTP.findOne({
      email,
      purpose: "FORGOT_PASSWORD",
    });
    const now = Date.now();

    if (existingOtp && existingOtp.blockedUntil && existingOtp.blockedUntil > new Date()) {
      const timeLeftMs = existingOtp.blockedUntil.getTime() - now;
      const minutesLeft = Math.ceil(timeLeftMs / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. OTP verification is locked for ${minutesLeft} minute(s).`,
        blockedUntil: existingOtp.blockedUntil.getTime()
      });
    }

    // ── 30-second cooldown between individual resends ────────────
    if (existingOtp && now - existingOtp.createdAt.getTime() < 30 * 1000) {
      const secsLeft = Math.ceil(
        30 - (now - existingOtp.createdAt.getTime()) / 1000,
      );
      return res.status(429).json({
        message: `Please wait ${secsLeft} second(s) before requesting a new OTP.`,
      });
    }

    const currentResendCount = existingOtp?.resendCount || 0;
    const newResendCount = currentResendCount + 1;

    if (newResendCount >= 5) {
      const blockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      await OTP.deleteMany({ email, purpose: "FORGOT_PASSWORD" });
      await OTP.create({
        email,
        otpCode: "DISABLED",
        purpose: "FORGOT_PASSWORD",
        resendCount: newResendCount,
        attempts: 0,
        blockedUntil: blockedUntil,
      });

      return res.status(403).json({
        message: "Maximum resend attempts reached. OTP verification is locked for 5 minutes.",
        blockedUntil: blockedUntil.getTime(),
      });
    }

    // ── Generate and send new OTP ─────────────────────────────────
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const currentAttempts = existingOtp?.attempts || 0;
    const currentBlockedUntil = existingOtp?.blockedUntil || null;

    await OTP.deleteMany({ email, purpose: "FORGOT_PASSWORD" });
    await OTP.create({
      email,
      otpCode: newOtp,
      purpose: "FORGOT_PASSWORD",
      resendCount: newResendCount,
      attempts: currentAttempts,
      blockedUntil: currentBlockedUntil,
    });

    await sendOtpEmail(email, newOtp);

    return res.status(200).json({
      message: "OTP resent successfully.",
      resendCount: newResendCount,
    });
  } catch (error) {
    console.error("Resend forgot OTP error:", error);
    return res.status(500).json({ message: "Failed to resend OTP." });
  }
};

export const getResetPassword = (req, res) => {
  if (!req.session.forgotEmail || !req.session.otpVerified) {
    return res.redirect("/auth/forgot-password");
  }
  res.render("user/reset-password", { title: "Reset Password | Nafahath" });
};

export const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.forgotEmail;

    if (!email || !req.session.otpVerified) {
      return res
        .status(403)
        .json({ message: "Unauthorized. Please verify your OTP first." });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
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



