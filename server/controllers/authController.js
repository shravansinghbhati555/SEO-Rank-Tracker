import User from "../models/User.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

//register user

export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const adminEmail = process.env.ADMIN_EMAIL
            ?.replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            credits: 2,
            role:
                adminEmail && normalizedEmail === adminEmail ? "admin" : "user",
            analysisEnabled: true,
        });

        const token = generateToken(user._id);

        const safeUser = user.toObject();
        delete safeUser.password;

        return res.status(201).json({
            success: true,
            token,
            user: safeUser,
        });
    } catch (error) {
        console.error("Register error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};


//login user 

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail,
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Allow the configured admin email to become admin.
        const adminEmail = process.env.ADMIN_EMAIL
            ?.replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();

        if (
            adminEmail &&
            normalizedEmail === adminEmail &&
            user.role !== "admin"
        ) {
            user.role = "admin";
            await user.save();
        }

        const token = generateToken(user._id);

        const safeUser = user.toObject();
        delete safeUser.password;

        return res.status(200).json({
            success: true,
            token,
            user: safeUser,
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};


//Get current user
export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
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

        res.json({ success: true, user });
    } catch (error) {
        console.error("Get user error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};