import type Database from "better-sqlite3";

export function recalculateMonth(db: Database.Database, month: string): void {
  // Delete existing aggregates for this month
  db.prepare("DELETE FROM monthly_aggregates WHERE month = ?").run(month);

  // Aggregate transactions by category for this month
  const rows = db.prepare(`
    SELECT
      categoryId,
      SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN direction = 'transfer' THEN amount ELSE 0 END) as transferOut,
      SUM(CASE WHEN isRecurring = 1 THEN amount ELSE 0 END) as recurringAmount,
      COUNT(*) as transactionCount
    FROM transactions
    WHERE substr(transactionDate, 1, 7) = ? AND categoryId IS NOT NULL
    GROUP BY categoryId
  `).all(month) as any[];

  const insert = db.prepare(`
    INSERT INTO monthly_aggregates (month, categoryId, income, expense, transferOut, recurringAmount, transactionCount, lastRecalculatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  for (const row of rows) {
    insert.run(month, row.categoryId, row.income, row.expense, row.transferOut, row.recurringAmount, row.transactionCount);
  }
}

export function recalculateAll(db: Database.Database): void {
  const months = db.prepare(
    "SELECT DISTINCT substr(transactionDate, 1, 7) as month FROM transactions WHERE categoryId IS NOT NULL ORDER BY month"
  ).all() as { month: string }[];

  for (const { month } of months) {
    recalculateMonth(db, month);
  }
}

export function recalculateAffectedMonths(db: Database.Database, transactionDates: string[]): void {
  const months = new Set(transactionDates.map((d) => d.slice(0, 7)));
  for (const month of months) {
    recalculateMonth(db, month);
  }
}
