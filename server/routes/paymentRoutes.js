import express from "express";
import auth from "../middleware/authmiddleware.js";

import {
  getPlans,
  createOrder,
  verifyPayment,
} from "../controllers/paymentController.js";

const paymentRouter = express.Router();

// Get available plans
paymentRouter.get("/plans", getPlans);

// Create Razorpay order
paymentRouter.post("/create-order", auth, createOrder);

// Verify Razorpay payment
paymentRouter.post("/verify", auth, verifyPayment);

export default paymentRouter;