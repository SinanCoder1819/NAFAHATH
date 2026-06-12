import User from "../../models/User.model.js";
import mongoose from "mongoose";

const PAGE_SIZE = 5;



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

        //    console.log(users) 

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


export const toggleBlockUser = async (req, res) => {
    try {
        const { id }  = req.params;
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


async function destroyUserSession(userId) {
    try {
        const collection = mongoose.connection.db.collection("user_sessions");
        const userIdStr   = userId.toString();

        const result = await collection.deleteMany({
            $or: [
                { "session.user.id":  userIdStr },
                { "session.user._id": userIdStr },
            ],
        });

        if (result.deletedCount > 0) {
            console.log(`destroyUserSession: removed ${result.deletedCount} session(s) for user ${userIdStr}`);
        }
    } catch (err) {
        console.error("destroyUserSession error:", err);
    }
}
