import { Router } from "express";
import type Database from "better-sqlite3";

export function createTrajectoryRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const prevYear = year - 1;

    // Monthly spending for current and previous year
    const monthlySpending = db.prepare(`
      SELECT substr(transactionDate, 1, 7) as month,
        ROUND(SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END), 2) as expenses,
        ROUND(SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END), 2) as income
      FROM transactions
      WHERE substr(transactionDate, 1, 4) IN (?, ?)
      GROUP BY month ORDER BY month
    `).all(String(year), String(prevYear)) as { month: string; expenses: number; income: number }[];

    // Savings goals
    const savingsGoals = db.prepare(
      "SELECT * FROM savings_goals WHERE year = ? ORDER BY month"
    ).all(year) as any[];

    // Build 12-month arrays
    const currentYear = Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, "0")}`;
      const data = monthlySpending.find(s => s.month === m);
      return { month: i + 1, expenses: data?.expenses || 0, income: data?.income || 0 };
    });

    const previousYear = Array.from({ length: 12 }, (_, i) => {
      const m = `${prevYear}-${String(i + 1).padStart(2, "0")}`;
      const data = monthlySpending.find(s => s.month === m);
      return { month: i + 1, expenses: data?.expenses || 0, income: data?.income || 0 };
    });

    // Savings cumulative
    let investCum = 0;
    let savingsCum = 0;
    const savings = Array.from({ length: 12 }, (_, i) => {
      const goal = savingsGoals.find((g: any) => g.month === i + 1);
      investCum += goal?.investmentActual || 0;
      savingsCum += goal?.savingsActual || 0;
      return {
        month: i + 1,
        investmentGoal: goal?.investmentGoal || 0,
        investmentActual: goal?.investmentActual || 0,
        investmentCumulative: investCum,
        savingsGoal: goal?.savingsGoal || 0,
        savingsActual: goal?.savingsActual || 0,
        savingsCumulative: savingsCum,
      };
    });

    const totalInvestmentGoal = savingsGoals.reduce((s: number, g: any) => s + (g.investmentGoal || 0), 0);
    const totalInvestmentActual = savingsGoals.reduce((s: number, g: any) => s + (g.investmentActual || 0), 0);
    const totalSavingsGoal = savingsGoals.reduce((s: number, g: any) => s + (g.savingsGoal || 0), 0);
    const totalSavingsActual = savingsGoals.reduce((s: number, g: any) => s + (g.savingsActual || 0), 0);

    res.json({
      year,
      currentYear,
      previousYear,
      savings,
      totals: {
        investmentGoal: totalInvestmentGoal,
        investmentActual: totalInvestmentActual,
        savingsGoal: totalSavingsGoal,
        savingsActual: totalSavingsActual,
      },
    });
  });

  return router;
}
