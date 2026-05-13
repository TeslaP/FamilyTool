import { Router } from "express";
import type Database from "better-sqlite3";
import { generateMonthlySummary, gatherSummaryData } from "../ai/summary.js";

export function createSummaryRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/generate", async (req, res) => {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Valid month (YYYY-MM) required" });
      return;
    }

    try {
      const summary = await generateMonthlySummary(db, month);
      const data = gatherSummaryData(db, month);
      res.json({ summary, data });
    } catch (err: any) {
      res.status(500).json({ error: `Summary generation failed: ${err.message}` });
    }
  });

  return router;
}
