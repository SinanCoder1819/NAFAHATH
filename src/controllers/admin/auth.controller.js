import User from "../../models/User.model.js";
import bcrypt from "bcrypt";

export const getAdminLogin = (req, res) => {
    // Note: redirect-if-logged-in is handled by isAdminLogout middleware in the route.
    // This controller only runs when the admin is genuinely a guest.
    const error = req.session.adminError || null;
    delete req.session.adminError;

    res.render("admin/login", {
        layout: "layouts/admin",
        error,
    });
};






export const postAdminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account has been disabled." });
        }

        let passwordMatch = false;
        if (user.password) {
            const isHashed = user.password.startsWith("$2");
            passwordMatch = isHashed
                ? await bcrypt.compare(password, user.password)
                : password === user.password;
        }

        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Store admin _id as a plain string (same reason as user login)
        req.session.admin = {
            id:    user._id.toString(),
            name:  user.name,
            email: user.email,
            role:  user.role,
        };

        // Save session BEFORE responding to prevent race condition on redirect
        req.session.save((err) => {
            if (err) {
                console.error("Admin session save error:", err);
                return res.status(500).json({ message: "Server error. Please try again." });
            }
            return res.status(200).json({
                message: "Login successful.",
                redirectUrl: "/admin/dashboard",
            });
        });
    } catch (err) {
        console.error("Admin login error:", err);
        return res.status(500).json({ message: "Server error. Please try again." });
    }
};


export const getAdminLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Admin logout error:", err);
        res.clearCookie("admin.sid");
        res.redirect("/admin/login");
    });
};
