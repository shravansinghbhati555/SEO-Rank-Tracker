import mongoose from "mongoose";
import Analysis from "../models/Analysis.js";
import { analyzeSeoData } from "../services/geminiService.js";
import { scrapeUrl } from "../services/scraperService.js";

// Analyze URL
export const analyzeUrl = async (req, res) => {
  try {
    const { url } = req.body || {};

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
        /^https?:\/\//i.test(input) ? input : `https://${input}`,
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

    // Create database record first.
    const analysis = await Analysis.create({
      userId: req.userId,
      url: validUrl.href,
      status: "processing",
    });

    // Respond immediately; analysis continues in the background.
    res.status(202).json({
      success: true,
      message: "Analysis started",
      analysisId: analysis._id,
    });

    // Background processing
    (async () => {
      try {
        // Step 1: Scrape the URL using the Analysis document ID.
        const scrapeResult = await scrapeUrl(analysis._id);

        if (!scrapeResult.success) {
          throw new Error(scrapeResult.message || "Website scraping failed");
        }

        // Step 2: Analyze the scraped data with Gemini.
        const aiResult = await analyzeSeoData(scrapeResult.data);

        if (!aiResult?.success || !aiResult.data) {
          throw new Error(aiResult?.message || "AI SEO analysis failed");
        }

        const seoData = scrapeResult.data;
        const aiData = aiResult.data;

        // Step 3: Save final analysis.
        analysis.overallScore = aiData.overallScore ?? 0;
        analysis.categories = aiData.categories ?? {};
        analysis.metaData = seoData.metaData ?? {};
        analysis.headings = seoData.headings ?? {};
        analysis.links = seoData.links ?? {};
        analysis.images = seoData.images ?? {};
        analysis.keywords = aiData.keywords ?? seoData.keywords ?? [];
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
          console.error("Failed to save analysis status:", saveError.message);
        }
      }
    })();
  } catch (error) {
    console.error("Analyze URL error:", error.message);

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
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );
    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      Analysis.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-issues -keywords")
        .lean(),
      Analysis.countDocuments({ userId: req.userId }),
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
