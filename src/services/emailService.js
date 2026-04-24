import { transporter } from "../config/mailer.js";

/**
 * Sends OTP email to user
 */
export const sendOtpEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"Perfume Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Account - OTP",

      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Account Verification</h2>
          <p>Your OTP for verification is:</p>

          <h1 style="
            letter-spacing: 5px;
            background: #f3f3f3;
            padding: 10px;
            display: inline-block;
          ">
            ${otp}
          </h1>

          <p>This OTP will expire in 5 minutes.</p>

          <p>If you didn’t request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Email could not be sent");
  }
};