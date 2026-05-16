import { Router } from "express";
import type Database from "better-sqlite3";
import OpenAI from "openai";
import { loadConfig } from "../config.js";
import { buildReflectionPrompt, gatherPromptContext } from "../ai/prompts.js";

export function createSessionRouter(db: Database.Database): Router {
  const router = Router();

  // Generate reflection
  router.post("/reflect", async (req, res) => {
    const { month, intention } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Valid month (YYYY-MM) required" });
      return;
    }

    const config = loadConfig();
    if (!config.aiEnabled) {
      res.status(400).json({ error: "AI is not configured. Add OPENAI_API_KEY to .env" });
      return;
    }

    try {
      const ctx = gatherPromptContext(db, month, intention);
      const { system, user } = buildReflectionPrompt(ctx);

      const client = new OpenAI({ apiKey: config.openaiApiKey });
      const response = await client.chat.completions.create({
        model: config.aiSummaryModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      const reflection = response.choices[0]?.message?.content || "Unable to generate reflection.";

      res.json({ reflection, context: ctx });
    } catch (err: any) {
      res.status(500).json({ error: `Reflection failed: ${err.message}` });
    }
  });

  // Save session
  router.post("/save", (req, res) => {
    const { month, intention, aiReflection, closingNote } = req.body;

    if (!month || !aiReflection) {
      res.status(400).json({ error: "month and aiReflection required" });
      return;
    }

    const result = db.prepare(
      "INSERT INTO session_reflections (month, intention, aiReflection, closingNote) VALUES (?, ?, ?, ?)"
    ).run(month, intention || null, aiReflection, closingNote || null);

    res.json({ id: Number(result.lastInsertRowid) });
  });

  // Get sessions for a month
  router.get("/", (req, res) => {
    const { month } = req.query;
    if (month) {
      const sessions = db.prepare(
        "SELECT * FROM session_reflections WHERE month = ? ORDER BY createdAt DESC"
      ).all(month);
      res.json(sessions);
    } else {
      const sessions = db.prepare(
        "SELECT * FROM session_reflections ORDER BY createdAt DESC LIMIT 12"
      ).all();
      res.json(sessions);
    }
  });

  return router;
}
