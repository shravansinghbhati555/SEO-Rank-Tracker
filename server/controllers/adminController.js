import User from "../models/User.js";
import Analysis from "../models/Analysis.js";


export const getAdminDashboard = async (req, res) => {
    try {
        const [
            totalUsers,
            totalAnalyses,
            activeUsers,
            creditResult,
            users,
        ] = await Promise.all([
            User.countDocuments(),
            Analysis.countDocuments(),
            User.countDocuments({ analysisEnabled: { $ne: false } }),
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCredits: { $sum: "$credits" },
                    },
                },
            ]),
            User.find()
                .select("name email role credits analysisEnabled plan createdAt")
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        const adminEmail = process.env.ADMIN_EMAIL
            ?.replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();

        const formattedUsers = users.map((u) => ({
            ...u,
            role:
                u.role ||
                (adminEmail && u.email?.toLowerCase().trim() === adminEmail
                    ? "admin"
                    : "user"),
        }));

        return res.json({
            success: true,
            stats: {
                totalUsers,
                totalAnalyses,
                activeUsers,
                totalCredits: creditResult[0]?.totalCredits ?? 0,
            },
            users: formattedUsers,
        });
    } catch (error) {
        console.error("Admin dashboard error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

// Add or remove credits
export const updateUserCredits = async (req, res) => {
    try {
        const { amount } = req.body;
        const { id } = req.params;

        if (
            !Number.isSafeInteger(amount) ||
            amount === 0 ||
            Math.abs(amount) > 100000
        ) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a non-zero integer.",
            });
        }

        const filter = { _id: id };

        if (amount < 0) {
            filter.credits = { $gte: Math.abs(amount) };
        }

        const user = await User.findOneAndUpdate(
            filter,
            { $inc: { credits: amount } },
            { new: true, runValidators: true }
        ).select("name email credits role analysisEnabled");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found or insufficient credits.",
            });
        }

        return res.json({
            success: true,
            message: "Credits updated successfully.",
            user,
        });
    } catch (error) {
        console.error("Update credits error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

// Enable or disable analysis
export const toggleUserAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "enabled must be true or false.",
            });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: { analysisEnabled: enabled } },
            { new: true, runValidators: true }
        ).select("name email credits role analysisEnabled");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        return res.json({
            success: true,
            message: enabled
                ? "Analysis enabled."
                : "Analysis disabled.",
            user,
        });
    } catch (error) {
        console.error("Toggle analysis error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
