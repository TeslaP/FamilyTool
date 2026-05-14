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

  router.get("/pacing", (req, res) => {
    const { month } = req.query;
    if (!month || typeof month !== "string") {
      res.status(400).json({ error: "month parameter required (YYYY-MM)" });
      return;
    }

    // Get all transactions for this month
    const transactions = db.prepare(
      "SELECT transactionDate, amount, direction FROM transactions WHERE substr(transactionDate, 1, 7) = ? ORDER BY transactionDate"
    ).all(month) as { transactionDate: string; amount: number; direction: string }[];

    // Calculate income and expenses
    const totalIncome = transactions.filter(t => t.direction === "income").reduce((s, t) => s + t.amount, 0);

    // Split into weeks (ISO week boundaries within the month)
    const [yearNum, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(yearNum, monthNum - 1, 1);
    const lastDay = new Date(yearNum, monthNum, 0);

    const weeks: { weekNum: number; startDate: string; endDate: string; spent: number; income: number }[] = [];

    let weekStart = new Date(firstDay);
    // Align to Monday
    const dayOfWeek = weekStart.getDay();
    if (dayOfWeek !== 1) {
      // Don't go back before month start
    }

    let weekNum = 1;
    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());

      const startStr = weekStart.toISOString().slice(0, 10);
      const endStr = weekEnd.toISOString().slice(0, 10);

      const weekTxns = transactions.filter(t => t.transactionDate >= startStr && t.transactionDate <= endStr);
      const spent = weekTxns.filter(t => t.direction === "expense").reduce((s, t) => s + t.amount, 0);
      const income = weekTxns.filter(t => t.direction === "income").reduce((s, t) => s + t.amount, 0);

      weeks.push({ weekNum, startDate: startStr, endDate: endStr, spent: Math.round(spent * 100) / 100, income: Math.round(income * 100) / 100 });

      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() + 1);
      weekNum++;
    }

    // Calculate cumulative remaining
    let cumIncome = 0;
    let cumExpenses = 0;
    const weeklyData = weeks.map(w => {
      cumIncome += w.income;
      cumExpenses += w.spent;
      const remaining = Math.round((cumIncome - cumExpenses) * 100) / 100;
      return { ...w, remaining };
    });

    // Projection
    const totalDays = lastDay.getDate();
    const today = new Date();
    const currentDay = today.getFullYear() === yearNum && today.getMonth() === monthNum - 1
      ? today.getDate()
      : totalDays;
    const daysLeft = totalDays - currentDay;
    const dailySpend = cumExpenses / Math.max(currentDay, 1);
    const projectedRemaining = Math.round((totalIncome - cumExpenses - (dailySpend * daysLeft)) * 100) / 100;

    // Trend
    let trend: "stable" | "tightening" | "improving" = "stable";
    if (weeks.length >= 2) {
      const lastWeekSpend = weeks[weeks.length - 1].spent;
      const prevWeekSpend = weeks[weeks.length - 2].spent;
      if (lastWeekSpend > prevWeekSpend * 1.15) trend = "tightening";
      else if (lastWeekSpend < prevWeekSpend * 0.85) trend = "improving";
    }

    res.json({
      month,
      totalIncome: Math.round(totalIncome * 100) / 100,
      weeks: weeklyData,
      projection: { remaining: projectedRemaining, trend },
    });
  });

  router.delete("/:id", (req, res) => {
    const { id } = req.params;

    const existing = db.prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id)) as any;
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    db.prepare("DELETE FROM transactions WHERE id = ?").run(Number(id));
    recalculateAffectedMonths(db, [existing.transactionDate]);

    res.json({ deleted: true, id: Number(id) });
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
