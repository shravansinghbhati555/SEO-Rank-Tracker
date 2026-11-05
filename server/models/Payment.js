
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "INR",
    },
    orderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
    creditsGranted: {
      type: Boolean,
      default: false,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index(
  { paymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentId: { $type: "string" },
    },
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
