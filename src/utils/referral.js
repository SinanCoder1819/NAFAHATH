import User from "../models/User.model.js";

/**
 * Generates a unique referral code starting with NAFA followed by 6 random alphanumeric characters.
 * Guarantees uniqueness by checking the database.
 * @returns {Promise<string>}
 */
export async function generateUniqueReferralCode() {
    const prefix = "NAFA";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code;
    let exists = true;

    while (exists) {
        code = prefix;
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const user = await User.findOne({ referralCode: code });
        
        if (!user) {
            exists = false;
        }
    }
    return code;
}
