
import express from "express";
import auth from "../middleware/authmiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

import {
    getAdminDashboard,
    updateUserCredits,
    toggleUserAnalysis,
} from "../controllers/adminController.js";

const adminRouter = express.Router();

adminRouter.use(auth, adminMiddleware);

adminRouter.get("/dashboard", getAdminDashboard);

adminRouter.patch("/users/:id/credits", updateUserCredits);

adminRouter.patch("/users/:id/analysis", toggleUserAnalysis);

export default adminRouter;
