import { Router } from "express";
import type Database from "better-sqlite3";
import { recalculateAffectedMonths } from "../services/recalculation.js";

export function createTransactionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const { month, needsReview } = req.query;

    let query = "SELECT * FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (month) {
      query += " AND substr(transactionDate, 1, 7) = ?";
      params.push(month);
    }

    if (needsReview === "true") {
      query += " AND (confidence < 0.7 OR categoryId IS NULL OR isReviewed = 0)";
    }

    query += " ORDER BY transactionDate DESC, id DESC";

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  });

  router.patch("/:id", (req, res) => {
    const { id } = req.params;
    const { categoryId, merchantName, direction } = req.body;

    const existing = db.prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id)) as any;
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (categoryId !== undefined) {
      updates.push("categoryId = ?");
      values.push(categoryId);
    }
    if (merchantName !== undefined) {
      updates.push("merchantName = ?");
      values.push(merchantName);
    }
    if (direction !== undefined) {
      updates.push("direction = ?");
      values.push(direction);
    }

    // Always mark as manually reviewed
    updates.push("isReviewed = 1");
    updates.push("confidence = 1.0");
    updates.push("categorisationMethod = 'manual'");

    if (updates.length > 0) {
      values.push(Number(id));
      db.prepare(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }

    // Trigger recalculation
    recalculateAffectedMonths(db, [existing.transactionDate]);

    const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id));
    res.json(updated);
  });

  router.post("/:id/create-rule", (req, res) => {
    const { id } = req.params;
    const { matchType, matchValue } = req.body;

    const transaction = db.prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id)) as any;
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    if (!matchType || !matchValue) {
      res.status(400).json({ error: "matchType and matchValue required" });
      return;
    }

    const confidence = matchType === "exact" ? 1.0 : matchType === "contains" ? 0.9 : 0.85;

    const result = db.prepare(`
      INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      matchType,
      matchValue,
      transaction.merchantName || matchValue,
      transaction.categoryId,
      transaction.direction,
      confidence
    );

    const rule = db.prepare("SELECT * FROM categorisation_rules WHERE id = ?").get(Number(result.lastInsertRowid));
    res.status(201).json(rule);
  });

  return router;
}
