import { Router } from "express";
import type Database from "better-sqlite3";
import { gatherPeriodData, computeInputHash, generateTemporalReflection, type TemporalReflectionRow } from "../ai/temporal.js";

export function createReflectionsRouter(db: Database.Database): Router {
  const router = Router();

  // Get cached reflection for a period
  router.get("/temporal", (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
      res.status(400).json({ error: "from and to params required (YYYY-MM)" });
      return;
    }

    const cached = db.prepare(
      "SELECT * FROM temporal_reflections WHERE periodStart = ? AND periodEnd = ?"
    ).get(from, to) as TemporalReflectionRow | undefined;

    if (!cached) {
      res.json({ exists: false, reflection: null, dataChanged: false });
      return;
    }

    // Check if data has changed
    const currentData = gatherPeriodData(db, from as string, to as string);
    const currentHash = computeInputHash(currentData);
    const dataChanged = cached.inputHash !== currentHash;

    res.json({
      exists: true,
      reflection: cached.reflection,
      generatedAt: cached.generatedAt,
      dataChanged,
    });
  });

  // Generate (or regenerate) reflection for a period
  router.post("/temporal/generate", async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) {
      res.status(400).json({ error: "from and to required (YYYY-MM)" });
      return;
    }

    try {
      const reflection = await generateTemporalReflection(db, from, to);
      const data = gatherPeriodData(db, from, to);
      const inputHash = computeInputHash(data);

      // Upsert
      db.prepare(`
        INSERT INTO temporal_reflections (periodStart, periodEnd, reflection, inputHash, generatedAt)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(periodStart, periodEnd)
        DO UPDATE SET reflection = ?, inputHash = ?, updatedAt = datetime('now')
      `).run(from, to, reflection, inputHash, reflection, inputHash);

      res.json({ reflection, inputHash });
    } catch (err: any) {
      res.status(500).json({ error: `Generation failed: ${err.message}` });
    }
  });

  return router;
}
