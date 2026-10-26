
import mongoose from "mongoose";
import Analysis from "../models/Analysis.js";
import { analyzeSeoData } from "../services/geminiService.js";
import { scrapeUrl } from "../services/scraperService.js";
import User from "../models/User.js";

// Analyze URL
export const analyzeUrl = async (req, res) => {
  let creditDeducted = false;

  try {
    const { url } = req.body || {};

    // Step 1: Validate URL
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    let validUrl;

    try {
      const input = url.trim();

      validUrl = new URL(
        /^https?:\/\//i.test(input) ? input : `https://${input}`
      );

      if (!["http:", "https:"].includes(validUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    // Step 2: Check user and deduct one credit atomically
    const user = await User.findOneAndUpdate(
      {
        _id: req.userId,
        analysisEnabled: { $ne: false },
        credits: { $gte: 1 },
      },
      {
        $inc: { credits: -1 },
      },
      {
        new: true,
      }
    );

    if (!user) {
      const existingUser = await User.findById(req.userId)
        .select("credits analysisEnabled");

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (existingUser.analysisEnabled === false) {
        return res.status(403).json({
          success: false,
          message:
            "Your analysis access has been disabled by admin.",
        });
      }

      return res.status(403).json({
        success: false,
        message: "No credits remaining. Please contact admin.",
        credits: existingUser.credits ?? 0,
      });
    }

    creditDeducted = true;

    // Step 3: Create analysis record
    let analysis;

    try {
      analysis = await Analysis.create({
        userId: req.userId,
        url: validUrl.href,
        status: "processing",
      });
    } catch (error) {
      // Refund credit if analysis record creation fails
      await User.updateOne(
        { _id: req.userId },
        { $inc: { credits: 1 } }
      );

      creditDeducted = false;
      throw error;
    }

    // Step 4: Respond immediately
    res.status(202).json({
      success: true,
      message: "Analysis started",
      analysisId: analysis._id,
      credits: user.credits,
    });

    // Step 5: Run SEO analysis in the background
    (async () => {
      try {
        // Scrape website
        const scrapeResult = await scrapeUrl(analysis._id);

        if (!scrapeResult?.success || !scrapeResult.data) {
          throw new Error(
            scrapeResult?.message || "Website scraping failed"
          );
        }

        // Analyze scraped data using Gemini
        const aiResult = await analyzeSeoData(scrapeResult.data);

        if (!aiResult?.success || !aiResult.data) {
          throw new Error(
            aiResult?.message || "AI SEO analysis failed"
          );
        }

        const seoData = scrapeResult.data;
        const aiData = aiResult.data;

        // Save analysis results
        analysis.overallScore = aiData.overallScore ?? 0;
        analysis.categories = aiData.categories ?? {};
        analysis.metaData = seoData.metaData ?? {};
        analysis.headings = seoData.headings ?? {};
        analysis.links = seoData.links ?? {};
        analysis.images = seoData.images ?? {};
        analysis.keywords =
          aiData.keywords ?? seoData.keywords ?? [];
        analysis.issues = aiData.issues ?? [];
        analysis.loadTime = seoData.loadTime ?? 0;
        analysis.pageSize = seoData.pageSize ?? 0;
        analysis.wordCount = seoData.wordCount ?? 0;
        analysis.url = seoData.url || analysis.url;
        analysis.status = "completed";

        await analysis.save();

        console.log("SEO analysis completed:", {
          analysisId: analysis._id,
          url: analysis.url,
          overallScore: analysis.overallScore,
        });
      } catch (error) {
        console.error("Background analysis error:", error.message);

        try {
          analysis.status = "failed";
          await analysis.save();
        } catch (saveError) {
          console.error(
            "Failed to save analysis status:",
            saveError.message
          );
        }
      }
    })();
  } catch (error) {
    console.error("Analyze URL error:", error.message);

    // Refund credit if deducted but no response was sent
    if (creditDeducted && !res.headersSent) {
      try {
        await User.updateOne(
          { _id: req.userId },
          { $inc: { credits: 1 } }
        );
      } catch (refundError) {
        console.error(
          "Credit refund error:",
          refundError.message
        );
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
};

// Get one analysis by ID
export const getAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    const analysis = await Analysis.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    return res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Get analysis error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all analyses for the logged-in user
export const getAnalyses = async (req, res) => {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      Analysis.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-issues -keywords")
        .lean(),

      Analysis.countDocuments({
        userId: req.userId,
      }),
    ]);

    return res.json({
      success: true,
      analyses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get analyses error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete one analysis belonging to the logged-in user
export const deleteanalysis = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    const analysis = await Analysis.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    return res.json({
      success: true,
      message: "Analysis deleted successfully",
    });
  } catch (error) {
    console.error("Delete analysis error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
