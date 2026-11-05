
import mongoose from "mongoose";

import User from "../models/User.js";
import Analysis from "../models/Analysis.js";
import Payment from "../models/Payment.js";

import { PREMIUM_PLANS } from "../config/premiumPlan.js";

// Dynamically get plan names from premiumPlan.js
const planNames = Object.fromEntries(
  PREMIUM_PLANS.map((plan) => [plan.id, plan.name])
);

// Admin dashboard
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

      User.countDocuments({
        analysisEnabled: { $ne: false },
      }),

      User.aggregate([
        {
          $group: {
            _id: null,
            totalCredits: {
              $sum: { $ifNull: ["$credits", 0] },
            },
          },
        },
      ]),

      User.find()
        .select(
          "name email role credits analysisEnabled plan currentPlanId planExpiresAt createdAt"
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const userIds = users.map((user) => user._id);

    // Fetch all payments
    const payments = userIds.length
      ? await Payment.find({
          userId: { $in: userIds },
        })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Latest payment of any status
    const latestPaymentByUser = new Map();

    for (const payment of payments) {
      const id = String(payment.userId);

      if (!latestPaymentByUser.has(id)) {
        latestPaymentByUser.set(id, payment);
      }
    }

    // All successfully paid payments
    const allPaidPayments = payments.filter(
      (payment) => payment.status === "paid"
    );

    // Group all purchased plans by user
    const purchasedPlansByUser = new Map();

    for (const payment of allPaidPayments) {
      const id = String(payment.userId);

      if (!purchasedPlansByUser.has(id)) {
        purchasedPlansByUser.set(id, []);
      }

      purchasedPlansByUser.get(id).push({
        paymentId: String(payment._id),

        planId: payment.planId || null,

        planName:
          payment.planName ||
          planNames[payment.planId] ||
          payment.planId ||
          "Unknown Plan",

        amount: payment.amount ?? null,

        purchaseDate:
          payment.activatedAt ||
          payment.createdAt ||
          null,

        status: payment.status,
      });
    }

    // Latest successfully paid payment with credits granted
    const paidPayments = userIds.length
      ? await Payment.find({
          userId: { $in: userIds },
          status: "paid",
          creditsGranted: true,
        })
          .sort({
            activatedAt: -1,
            createdAt: -1,
          })
          .lean()
      : [];

    const latestPaidPaymentByUser = new Map();

    for (const payment of paidPayments) {
      const id = String(payment.userId);

      if (!latestPaidPaymentByUser.has(id)) {
        latestPaidPaymentByUser.set(id, payment);
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL
      ?.replace(/^["']|["']$/g, "")
      .trim()
      .toLowerCase();

    // Format users
    const formattedUsers = users.map((user) => {
      const id = String(user._id);

      const latestPayment = latestPaymentByUser.get(id);

      const latestPaidPayment =
        latestPaidPaymentByUser.get(id);

      // Current plan
      const currentPlanId =
        user.currentPlanId ||
        latestPaidPayment?.planId ||
        null;

      // All purchased plans
      const purchasedPlans = [
        ...(purchasedPlansByUser.get(id) || []),
      ];

      // Put current plan first in the array
      const currentPlanIndex = purchasedPlans.findIndex(
        (plan) => plan.planId === currentPlanId
      );

      if (currentPlanIndex > 0) {
        const [currentPlan] = purchasedPlans.splice(
          currentPlanIndex,
          1
        );

        purchasedPlans.unshift(currentPlan);
      }

      // Mark current plan
      if (currentPlanId) {
        const currentPlanExists = purchasedPlans.some(
          (plan) => plan.planId === currentPlanId
        );

        // Support old users whose current plan is not
        // available in payment history
        if (!currentPlanExists) {
          purchasedPlans.unshift({
            paymentId: null,
            planId: currentPlanId,
            planName:
              planNames[currentPlanId] || currentPlanId,
            amount: null,
            purchaseDate: null,
            status: "active",
          });
        }
      }

      if (purchasedPlans.length > 0 && currentPlanId) {
        const currentPlan = purchasedPlans.find(
          (plan) => plan.planId === currentPlanId
        );

        if (currentPlan) {
          currentPlan.isCurrent = true;
        }
      }

      const isExpired =
        user.planExpiresAt &&
        new Date(user.planExpiresAt).getTime() < Date.now();

      const role =
        user.role ||
        (
          adminEmail &&
          user.email?.toLowerCase().trim() === adminEmail
            ? "admin"
            : "user"
        );

      return {
        ...user,

        role,

        currentPlanId,

        paymentHistory: (purchasedPlansByUser.get(id) || []).map((plan) => {
  const payment = payments.find(
    (p) => String(p._id) === plan.paymentId
  );

  return {
    ...plan,
    paymentStatus: payment?.status || "unknown",
    orderId: payment?.orderId || null,
  };
}),

        planName: currentPlanId
          ? planNames[currentPlanId] || currentPlanId
          : user.plan === "pro"
            ? "Pro"
            : "Free",

        // All purchased plans for frontend
        purchasedPlans,

        // Total purchased plan records
        totalPurchasedPlans: purchasedPlans.length,

        planExpiresAt: user.planExpiresAt || null,

        planStatus: !currentPlanId
          ? "Free"
          : isExpired
            ? "Expired"
            : "Active",

        // Latest payment information
        paymentStatus:
          latestPayment?.status || "No payment",

        lastPaymentPlanId:
          latestPayment?.planId || null,

        lastPaymentAmount:
          latestPayment?.amount ?? null,

        lastPaymentDate:
          latestPayment?.createdAt || null,

        lastPaymentId:
          latestPayment?.paymentId || null,

        lastOrderId:
          latestPayment?.orderId || null,

        lastPaidPaymentDate:
          latestPaidPayment?.activatedAt ||
          latestPaidPayment?.createdAt ||
          null,
      };
    });

    return res.status(200).json({
      success: true,

      stats: {
        totalUsers,
        totalAnalyses,
        activeUsers,
        totalCredits:
          creditResult[0]?.totalCredits ?? 0,
      },

      users: formattedUsers,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load admin dashboard.",
    });
  }
};

// Add or remove user credits
export const updateUserCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

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

    const filter = {
      _id: id,
    };

    // Prevent negative credits
    if (amount < 0) {
      filter.credits = {
        $gte: Math.abs(amount),
      };
    }

    const user = await User.findOneAndUpdate(
      filter,
      {
        $inc: {
          credits: amount,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "name email credits role analysisEnabled plan"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found or insufficient credits.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        amount > 0
          ? `${amount} credits added successfully.`
          : `${Math.abs(amount)} credits removed successfully.`,
      user,
    });
  } catch (error) {
    console.error("Update credits error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update credits.",
    });
  }
};

// Enable or disable user analysis
export const toggleUserAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be true or false.",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          analysisEnabled: enabled,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "name email credits role analysisEnabled"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message: enabled
        ? "Analysis enabled successfully."
        : "Analysis disabled successfully.",

      user,
    });
  } catch (error) {
    console.error("Toggle analysis error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update analysis access.",
    });
  }
};
