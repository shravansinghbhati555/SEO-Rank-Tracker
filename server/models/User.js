import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    credits: { type: Number, default: 2, min: 0, },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    analysisEnabled: { type: Boolean, default: true },
    analysisCount: { type: Number, default: 0 },
    lastAnalysisDate: { type: Date, default: null }
}, { timestamps: true })

const User = mongoose.model("User", userSchema)
export default User