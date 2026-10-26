import User from "../models/User.js";

const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select("role email");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        const adminEmail = process.env.ADMIN_EMAIL
            ?.replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();

        if (
            adminEmail &&
            user.email?.toLowerCase().trim() === adminEmail &&
            user.role !== "admin"
        ) {
            user.role = "admin";
            await user.save();
        }

        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Admin middleware error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

export default adminMiddleware;
