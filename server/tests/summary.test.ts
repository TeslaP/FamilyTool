import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { gatherSummaryData } from "../src/ai/summary.js";
import { recalculateMonth } from "../src/services/recalculation.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const fileId = db.prepare("INSERT INTO import_files (fileName, rowCount) VALUES ('test.tab', 3)").run().lastInsertRowid;
  const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
  const salary = db.prepare("SELECT id FROM categories WHERE name = 'Salary'").get() as any;

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, rawDescription, fingerprint, categoryId, confidence, categorisationMethod)
    VALUES (?, '2026-01-10', '2026-01-10', 3000, 'income', 'Salary', 'fp1', ?, 1.0, 'rule')
  `).run(fileId, salary.id);

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, rawDescription, fingerprint, categoryId, confidence, categorisationMethod)
    VALUES (?, '2026-01-15', '2026-01-15', 200, 'expense', 'Groceries', 'fp2', ?, 1.0, 'rule')
  `).run(fileId, groceries.id);

  recalculateMonth(db, "2026-01");
});

describe("gatherSummaryData", () => {
  it("returns totals for a month", () => {
    const data = gatherSummaryData(db, "2026-01");
    expect(data.totalIncome).toBe(3000);
    expect(data.totalExpenses).toBe(200);
    expect(data.netCashflow).toBe(2800);
  });

  it("returns category breakdown sorted by amount", () => {
    const data = gatherSummaryData(db, "2026-01");
    expect(data.categoryBreakdown.length).toBeGreaterThan(0);
    expect(data.categoryBreakdown[0].amount).toBeGreaterThanOrEqual(
      data.categoryBreakdown[data.categoryBreakdown.length - 1].amount
    );
  });

  it("returns null previousMonth when no data", () => {
    const data = gatherSummaryData(db, "2026-01");
    expect(data.previousMonth).toBeNull();
  });

  it("returns empty data for month with no transactions", () => {
    const data = gatherSummaryData(db, "2026-06");
    expect(data.totalIncome).toBe(0);
    expect(data.totalExpenses).toBe(0);
  });
});
