import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import User from "../models/User.js";
import Payment from "../models/Payment.js";

import {
  PREMIUM_PLANS,
  getActivePlan,
} from "../config/premiumPlan.js";

// ------------------------------------------
// Razorpay Instance
// ------------------------------------------

const getRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are missing."
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// ------------------------------------------
// GET /api/payments/plans
// Get Active Premium Plans
// ------------------------------------------

export const getPlans = async (req, res) => {
  try {
    const plans = PREMIUM_PLANS
      .filter((plan) => plan.active === true)
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        amountPaise: plan.amountPaise,
        credits: plan.credits,
        validityDays: plan.validityDays,
        features: plan.features,
      }));

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error(
      "Get plans error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch plans.",
    });
  }
};

// ------------------------------------------
// POST /api/payments/create-order
// Create Razorpay Order
// ------------------------------------------

export const createOrder = async (req, res) => {
  try {
    const { planId } = req.body || {};

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required.",
      });
    }

    const plan = getActivePlan(planId);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive plan.",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const razorpay = getRazorpay();

    // Amount is always controlled by backend
    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",

      receipt: `rp_${Date.now()}`,

      notes: {
        userId: user._id.toString(),
        planId: plan.id,
      },
    });

    // Save payment order
    await Payment.create({
      userId: user._id,
      planId: plan.id,

      amount: plan.amountPaise,
      currency: "INR",

      orderId: order.id,
      paymentId: null,

      status: "created",
      creditsGranted: false,

      activatedAt: null,
      expiresAt: null,
    });

    return res.status(201).json({
      success: true,

      message: "Payment order created successfully.",

      orderId: order.id,
      amount: order.amount,
      currency: order.currency,

      keyId: process.env.RAZORPAY_KEY_ID,

      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        validityDays: plan.validityDays,
      },
    });
  } catch (error) {
    console.error(
      "Create order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order.",
    });
  }
};

// ------------------------------------------
// Verify Razorpay Signature
// ------------------------------------------

function verifyCheckoutSignature(
  orderId,
  paymentId,
  signature
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (
    !secret ||
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();

  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(
      received,
      expected
    )
  );
}

// ------------------------------------------
// Activate Captured Payment
// Shared by Verify API and Webhook
// ------------------------------------------

async function activateCapturedPayment(
  orderId,
  paymentId
) {
  const razorpay = getRazorpay();

  // Fetch actual payment details from Razorpay
  const gatewayPayment =
    await razorpay.payments.fetch(paymentId);

  if (
    gatewayPayment.order_id !== orderId ||
    gatewayPayment.status !== "captured" ||
    gatewayPayment.currency !== "INR"
  ) {
    throw new Error(
      "Payment is not captured or does not match the order."
    );
  }

  const session = await mongoose.startSession();

  try {
    let result = {
      activated: false,
    };

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        orderId,
      }).session(session);

      if (!payment) {
        throw new Error("Payment order not found.");
      }

      if (
        payment.paymentId &&
        payment.paymentId !== paymentId
      ) {
        throw new Error(
          "Payment ID does not match this order."
        );
      }

      // Prevent duplicate credit activation
      if (
        payment.creditsGranted ||
        payment.status === "paid"
      ) {
        result = {
          activated: false,
          alreadyProcessed: true,
        };

        return;
      }

      const plan = getActivePlan(payment.planId);

      // Validate payment details
      if (
        !plan ||
        !payment.userId ||
        payment.amount !== gatewayPayment.amount ||
        payment.amount !== plan.amountPaise ||
        payment.currency !== gatewayPayment.currency
      ) {
        throw new Error(
          "Payment amount or plan validation failed."
        );
      }

      // Atomically claim payment
      const claimed = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: "created",
          creditsGranted: false,
          paymentId: null,
        },
        {
          $set: {
            paymentId,
            status: "paid",
            creditsGranted: true,
            activatedAt: new Date(),
            expiresAt: null,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!claimed) {
        const latest = await Payment.findById(
          payment._id
        ).session(session);

        if (
          latest?.creditsGranted &&
          latest.paymentId === paymentId
        ) {
          result = {
            activated: false,
            alreadyProcessed: true,
          };

          return;
        }

        throw new Error(
          "Payment is already being processed."
        );
      }

      // Add purchased credits to user
      const updatedUser =
        await User.findByIdAndUpdate(
          payment.userId,
          {
            $inc: {
              credits: plan.credits,
            },

            $set: {
              plan: "pro",
              currentPlanId: plan.id,
              planExpiresAt: null,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!updatedUser) {
        throw new Error(
          "User not found while activating credits."
        );
      }

      result = {
        activated: true,
        creditsAdded: plan.credits,
        totalCredits: updatedUser.credits,
        planId: plan.id,
        planName: plan.name,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

// ------------------------------------------
// POST /api/payments/verify
// Verify Razorpay Payment
// ------------------------------------------

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    // Validate signature
    if (
      !verifyCheckoutSignature(
        orderId,
        paymentId,
        signature
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    // Check order ownership
    const ownedOrder = await Payment.findOne({
      orderId,
      userId: req.userId,
    });

    if (!ownedOrder) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found for this user.",
      });
    }

    // Verify captured payment with Razorpay
    const result = await activateCapturedPayment(
      orderId,
      paymentId
    );

    return res.status(200).json({
      success: true,

      message: result.alreadyProcessed
        ? "Payment was already processed."
        : "Payment verified successfully.",

      ...result,
    });
  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        "Payment could not be verified yet. Check payment status before retrying.",
    });
  }
};

// ------------------------------------------
// POST /api/payments/webhook
// Razorpay Webhook
// ------------------------------------------

export const paymentWebhook = async (req, res) => {
  try {
    const rawBody = req.body;

    const signature = req.get(
      "x-razorpay-signature"
    );

    const secret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (
      !Buffer.isBuffer(rawBody) ||
      !signature ||
      !secret ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return res.status(400).send(
        "Invalid webhook request."
      );
    }

    // Verify webhook signature
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest();

    const received = Buffer.from(
      signature,
      "hex"
    );

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(
        received,
        expected
      )
    ) {
      return res.status(400).send(
        "Invalid webhook signature."
      );
    }

    const event = JSON.parse(
      rawBody.toString("utf8")
    );

    // Ignore unrelated events
    if (
      event.event !== "payment.captured" &&
      event.event !== "order.paid"
    ) {
      return res.status(200).send(
        "Event ignored."
      );
    }

    const paymentEntity =
      event.payload?.payment?.entity;

    if (
      !paymentEntity?.id ||
      !paymentEntity?.order_id
    ) {
      return res.status(400).send(
        "Missing payment details."
      );
    }

    // Activate credits only after capture
    await activateCapturedPayment(
      paymentEntity.order_id,
      paymentEntity.id
    );

    return res.status(200).send(
      "Webhook processed successfully."
    );
  } catch (error) {
    console.error(
      "Payment webhook error:",
      error
    );

    return res.status(500).send(
      "Webhook processing failed."
    );
  }
};
