import express from "express";
import auth from "../middleware/authmiddleware.js"
import { analyzeUrl, deleteanalysis, getAnalyses, getAnalysis } from "../controllers/analysisController.js";

const analysisRouter = express.Router();

analysisRouter.post("/analyze", auth, analyzeUrl);
analysisRouter.get("/list", auth, getAnalyses);
analysisRouter.get("/:id", auth, getAnalysis);
analysisRouter.delete("/:id", auth, deleteanalysis);

export default analysisRouter;