import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const makeAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const email = (
            process.env.ADMIN_EMAIL?.replace(/^["']|["']$/g, "").trim() ||
            "admin@gmail.com"
        ).toLowerCase();

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            { $set: { role: "admin" } },
            { new: true }
        ).select("name email role");

        if (!user) {
            console.log("User not found. Register this email first.");
            return;
        }

        console.log("Admin role updated successfully:");
        console.log(user);
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
};

makeAdmin();
