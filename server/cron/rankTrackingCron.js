import cron from "node-cron"
import KeywordTracking from "../models/keytracker.js";
import { keywordTracking } from "../services/keywordtrackingservice.js";


export function startRankTrackingCron(){
    cron.schedule("0 6 * * *", async () => {
        console.log("Starting daily rank tracking...");
        try {
            const activeTracking = await KeywordTracking.find({active: true})
            for(const tracking of activeTracking){
            tracking.status = "checking";
            await tracking.save()

            const result = await keywordTracking(tracking)
            //Delay between checks to rate limiting
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 5000 ))
            }
        } catch (error) {
            console.error("[cron] Rank tracking cron error:", error.message);
        }
    })
    console.log("Renk tracking cron job scheduled")
}