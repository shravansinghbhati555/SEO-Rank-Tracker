import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

async function migrateCredits() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Set 2 credits only for existing users
        // whose credits field is missing.
        await User.updateMany(
            { credits: { $exists: false } },
            { $set: { credits: 2 } }
        );

        // Existing accounts remain normal users by default.
        await User.updateMany(
            { role: { $exists: false } },
            { $set: { role: "user" } }
        );

        await User.updateMany(
            { analysisEnabled: { $exists: false } },
            { $set: { analysisEnabled: true } }
        );

        const adminEmail = process.env.ADMIN_EMAIL
            ?.replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();

        if (adminEmail) {
            await User.updateOne(
                { email: adminEmail },
                { $set: { role: "admin" } }
            );
        }

        console.log("Credit migration completed.");
    } catch (error) {
        console.error("Migration failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateCredits();
