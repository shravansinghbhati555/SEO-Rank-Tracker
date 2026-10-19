
import KeywordTracking from "../models/keytracker.js";
import { ranktracker } from "./renkTrackerService.js";

export async function keywordTracking(tracking) {
  const trackingId = tracking._id;

  try {
    const result = await ranktracker(
      tracking.keyword,
      tracking.domain || tracking.url
    );

    console.log(
      "RANK TRACKER RESPONSE:",
      JSON.stringify(result, null, 2)
    );

    const current = await KeywordTracking.findById(trackingId);

    if (!current) {
      console.log("Tracking record no longer exists:", trackingId);
      return;
    }

    current.lastChecked = new Date();

    if (!result?.success) {
      current.status = "failed";
      await current.save();

      console.error("Rank check failed:", result?.error);
      return;
    }

    const data = result.data || {};
    const oldPosition = current.currentPosition;

    if (
      data.scanStatus === "completed" &&
      Number.isFinite(data.position) &&
      data.position > 0
    ) {
      const newPosition = data.position;

      current.currentPosition = newPosition;
      current.currentPage =
        data.page || Math.ceil(newPosition / 10);

      current.bestPosition =
        current.bestPosition == null
          ? newPosition
          : Math.min(current.bestPosition, newPosition);

      current.positionChange =
        oldPosition == null ? 0 : oldPosition - newPosition;

      current.status = "completed";
      current.competitors = data.competitors || [];
    } else if (data.scanStatus === "not_found") {
      current.currentPosition = null;
      current.currentPage = null;
      current.status = "completed";
      current.competitors = data.competitors || [];
    } else {
      current.status = "failed";
    }

    await current.save();

    console.log("KEYWORD TRACKING UPDATED:", {
      keyword: current.keyword,
      currentPosition: current.currentPosition,
      currentPage: current.currentPage,
      status: current.status,
      scanStatus: data.scanStatus,
    });

    return current;
  } catch (error) {
    console.error("Keyword tracking service error:", error);

    await KeywordTracking.findByIdAndUpdate(trackingId, {
      $set: {
        status: "failed",
        lastChecked: new Date(),
      },
    });

    return null;
  }
}
