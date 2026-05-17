import User from "../../models/User.model.js";
import mongoose from "mongoose";

const PAGE_SIZE = 5;

/**
 * GET /admin/customers
 */
export const getCustomers = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const search = (req.query.search || "").trim();

        const filter = { role: { $ne: "admin" } };
        if (search) {
            filter.$or = [
                { name:  { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const totalUsers  = await User.countDocuments(filter);
        const totalPages  = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
        const currentPage = Math.min(page, totalPages);

        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .select("name email phone isBlocked createdAt")
            .lean();

        res.render("admin/customers", {
            layout:     "layouts/admin",
            admin:      req.session.admin,
            activePage: "customers",
            users,
            search,
            currentPage,
            totalPages,
            totalUsers,
            pageSize:   PAGE_SIZE,
        });
    } catch (err) {
        console.error("getCustomers error:", err);
        res.status(500).send("Server error");
    }
};

/**
 * PATCH /admin/customers/:id/block
 * Blocks or unblocks a user. Blocking also destroys their active session.
 */
export const toggleBlockUser = async (req, res) => {
    try {
        const { id }     = req.params;
        const { action } = req.body;

        if (!["block", "unblock"].includes(action)) {
            return res.status(400).json({ message: "Invalid action." });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.role === "admin") {
            return res.status(403).json({ message: "Cannot block an admin account." });
        }

        user.isBlocked = action === "block";
        await user.save();

        // When blocking, kill the user's active session immediately
        if (action === "block") {
            await destroyUserSession(id.toString());
        }

        return res.status(200).json({
            message:   `User ${action === "block" ? "blocked" : "unblocked"} successfully.`,
            isBlocked: user.isBlocked,
        });
    } catch (err) {
        console.error("toggleBlockUser error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

/**
 * Delete all MongoDB sessions belonging to a given userId.
 * connect-mongo stores sessions as JSON strings in the `sessions` collection.
 */
async function destroyUserSession(userId) {
    try {
        // User sessions are stored in the "user_sessions" collection
        const collection = mongoose.connection.db.collection("user_sessions");
        await collection.deleteMany({ session: { $regex: userId } });
    } catch (err) {
        console.error("destroyUserSession error:", err);
    }
}
