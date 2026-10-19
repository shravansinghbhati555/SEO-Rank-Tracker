
import KeywordTracking from "../models/keytracker.js";
import { keywordTracking } from "../services/keywordtrackingservice.js";

// Add keyword
export const addKeyword = async (req, res) => {
  try {
    const { keyword, url } = req.body;

    if (
      typeof keyword !== "string" ||
      !keyword.trim() ||
      typeof url !== "string" ||
      !url.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Keyword and URL are required.",
      });
    }

    let urlObj;

    try {
      const input = url.trim();
      urlObj = new URL(
        /^https?:\/\//i.test(input) ? input : `https://${input}`
      );

      if (!["http:", "https:"].includes(urlObj.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format.",
      });
    }

    const cleanKeyword = keyword.trim().toLowerCase();
    const domain = urlObj.hostname
      .toLowerCase()
      .replace(/^www\./i, "");

    const existing = await KeywordTracking.findOne({
      userId: req.userId,
      keyword: cleanKeyword,
      domain,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already tracking this keyword for this domain.",
      });
    }

    const tracking = await KeywordTracking.create({
      userId: req.userId,
      keyword: cleanKeyword,
      url: urlObj.toString(),
      domain,
      status: "checking",
    });

    res.status(201).json({
      success: true,
      message: "Keyword tracking started.",
      tracking,
    });

    // Run the ranking check in the background.
    void keywordTracking(tracking).catch((error) => {
      console.error("Background keyword tracking error:", error);
    });
  } catch (error) {
    console.error("Add keyword error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Already tracking this keyword.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

// Get all keywords for the logged-in user
export const getKeywords = async (req, res) => {
  try {
    const keywords = await KeywordTracking.find({
      userId: req.userId,
    })
      .sort({ createdAt: -1 })
      .select("-rankHistory");

    return res.status(200).json({
      success: true,
      keywords,
    });
  } catch (error) {
    console.error("Get keywords error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tracked keywords.",
    });
  }
};

// Get one keyword
export const getKeyword = async (req, res) => {
  try {
    const tracking = await KeywordTracking.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Keyword tracking not found.",
      });
    }

    return res.status(200).json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error("Get keyword error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch keyword.",
    });
  }
};

// Refresh ranking
export const refreshKeyword = async (req, res) => {
  try {
    const tracking = await KeywordTracking.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Keyword tracking not found.",
      });
    }

    if (!tracking.active) {
      return res.status(400).json({
        success: false,
        message: "Tracking is disabled. Enable it before refreshing.",
      });
    }

    tracking.status = "checking";
    await tracking.save();

    res.status(200).json({
      success: true,
      message: "Rank check started.",
    });

    void keywordTracking(tracking).catch((error) => {
      console.error("Refresh tracking error:", error);
    });
  } catch (error) {
    console.error("Refresh keyword error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to refresh keyword.",
    });
  }
};

// Delete keyword
export const deleteKeyword = async (req, res) => {
  try {
    const tracking = await KeywordTracking.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Keyword tracking not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Keyword tracking deleted.",
    });
  } catch (error) {
    console.error("Delete keyword error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete keyword.",
    });
  }
};

// Toggle tracking
export const toggleTracking = async (req, res) => {
  try {
    const tracking = await KeywordTracking.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Keyword tracking not found.",
      });
    }

    tracking.active = !tracking.active;
    await tracking.save();

    return res.status(200).json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error("Toggle tracking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update tracking.",
    });
  }
};
