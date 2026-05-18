import { Router } from "express";
import type Database from "better-sqlite3";

export function createBudgetsRouter(db: Database.Database): Router {
  const router = Router();

  // Get budgets for a month
  router.get("/", (req, res) => {
    const { month } = req.query;
    if (!month) {
      res.status(400).json({ error: "month param required" });
      return;
    }
    const budgets = db.prepare(
      "SELECT categoryId, budgetAmount, isFixed FROM monthly_budgets WHERE month = ?"
    ).all(month);
    res.json(budgets);
  });

  // Save/update a budget for a category in a month
  router.post("/", (req, res) => {
    const { month, categoryId, budgetAmount, isFixed } = req.body;
    if (!month || !categoryId || budgetAmount === undefined) {
      res.status(400).json({ error: "month, categoryId, and budgetAmount required" });
      return;
    }

    db.prepare(`
      INSERT INTO monthly_budgets (month, categoryId, budgetAmount, isFixed)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(month, categoryId)
      DO UPDATE SET budgetAmount = ?, isFixed = ?
    `).run(month, categoryId, budgetAmount, isFixed ? 1 : 0, budgetAmount, isFixed ? 1 : 0);

    res.json({ saved: true });
  });

  // Bulk save budgets for a month
  router.post("/bulk", (req, res) => {
    const { month, budgets } = req.body as { month: string; budgets: { categoryId: number; budgetAmount: number; isFixed: boolean }[] };
    if (!month || !budgets) {
      res.status(400).json({ error: "month and budgets required" });
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO monthly_budgets (month, categoryId, budgetAmount, isFixed)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(month, categoryId)
      DO UPDATE SET budgetAmount = ?, isFixed = ?
    `);

    db.transaction(() => {
      for (const b of budgets) {
        stmt.run(month, b.categoryId, b.budgetAmount, b.isFixed ? 1 : 0, b.budgetAmount, b.isFixed ? 1 : 0);
      }
    })();

    res.json({ saved: budgets.length });
  });

  return router;
}
