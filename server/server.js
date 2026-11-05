import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import cors from "cors";
import "dotenv/config";

import connectDB from "./config/db.js";

import authRouter from "./routes/authRoutes.js";
import rankRouter from "./routes/renkRoutes.js";
import analysisRouter from "./routes/analysisRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";

import { paymentWebhook } from "./controllers/paymentController.js";
import { startRankTrackingCron } from "./cron/rankTrackingCron.js";

const app = express();

// CORS
app.use(cors());

// Razorpay webhook must receive raw body
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhook
);

// Normal JSON middleware
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/rank", rankRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentRouter);

// Database connection and cron
connectDB();
startRankTrackingCron();

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});