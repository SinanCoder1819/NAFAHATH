import { transporter } from "../config/mailer.js";


//  Sends OTP email to user

export const sendOtpEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"Nafahath Perfumes" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code - Nafahath",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #0a0a0a; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #0f0f0f; border: 1px solid #1f1f1f; border-radius: 24px; padding: 40px; text-align: center;">
            
            <h1 style="color: #C5A267; font-size: 18px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 8px;">NAFAHATH</h1>
            <p style="color: #666; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 32px;">Perfumes &amp; Fragrances</p>

            <h2 style="color: #ffffff; font-size: 22px; font-weight: 600; margin-bottom: 12px;">Verification Code</h2>
            <p style="color: #888; font-size: 14px; margin-bottom: 32px; line-height: 1.6;">
              Use the code below to complete your verification. This code expires in <strong style="color: #ccc;">5 minutes</strong>.
            </p>

            <div style="background-color: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #00FFFF; font-family: monospace;">${otp}</span>
            </div>

            <p style="color: #555; font-size: 12px; line-height: 1.6;">
              If you didn't request this code, you can safely ignore this email.<br>
              Someone else may have entered your email address by mistake.
            </p>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1f1f1f;">
              <p style="color: #444; font-size: 11px;">&copy; 2025 Nafahath Perfumes &amp; Fragrances. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Email could not be sent");
  }
};
