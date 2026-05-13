import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { recalculateMonth, recalculateAll } from "../src/services/recalculation.js";

let db: Database.Database;

function insertTestTransaction(
  db: Database.Database,
  overrides: Partial<{
    transactionDate: string;
    amount: number;
    direction: string;
    categoryId: number;
    isRecurring: number;
  }> = {}
) {
  // Ensure we have an import_files entry
  let fileId: any = db.prepare("SELECT id FROM import_files LIMIT 1").get();
  if (!fileId) {
    fileId = db.prepare("INSERT INTO import_files (fileName, rowCount) VALUES ('test.tab', 1)").run().lastInsertRowid;
  } else {
    fileId = fileId.id;
  }

  const defaults = {
    transactionDate: "2026-01-15",
    amount: 50.0,
    direction: "expense",
    categoryId: null as number | null,
    isRecurring: 0,
  };

  const merged = { ...defaults, ...overrides };

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, fingerprint, categoryId, isRecurring, confidence, categorisationMethod)
    VALUES (?, ?, ?, ?, ?, 1000, 950, 'Test', ?, ?, ?, 1.0, 'manual')
  `).run(
    fileId,
    merged.transactionDate,
    merged.transactionDate,
    merged.amount,
    merged.direction,
    `fp-${Math.random()}`,
    merged.categoryId,
    merged.isRecurring
  );
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);
});

describe("recalculateMonth", () => {
  it("calculates expense totals for a month", () => {
    const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-10", amount: 30, direction: "expense", categoryId: groceries.id });
    insertTestTransaction(db, { transactionDate: "2026-01-20", amount: 45, direction: "expense", categoryId: groceries.id });

    recalculateMonth(db, "2026-01");

    const agg = db.prepare("SELECT * FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", groceries.id) as any;
    expect(agg.expense).toBe(75);
    expect(agg.transactionCount).toBe(2);
  });

  it("calculates income totals", () => {
    const salary = db.prepare("SELECT id FROM categories WHERE name = 'Salary'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-01", amount: 3000, direction: "income", categoryId: salary.id });

    recalculateMonth(db, "2026-01");

    const agg = db.prepare("SELECT * FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", salary.id) as any;
    expect(agg.income).toBe(3000);
  });

  it("calculates transfer totals", () => {
    const savings = db.prepare("SELECT id FROM categories WHERE name = 'Savings'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-05", amount: 500, direction: "transfer", categoryId: savings.id });

    recalculateMonth(db, "2026-01");

    const agg = db.prepare("SELECT * FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", savings.id) as any;
    expect(agg.transferOut).toBe(500);
  });

  it("calculates recurring amount", () => {
    const mortgage = db.prepare("SELECT id FROM categories WHERE name = 'Mortgage'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-01", amount: 1200, direction: "expense", categoryId: mortgage.id, isRecurring: 1 });

    recalculateMonth(db, "2026-01");

    const agg = db.prepare("SELECT * FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", mortgage.id) as any;
    expect(agg.recurringAmount).toBe(1200);
  });

  it("replaces previous aggregates on recalculation", () => {
    const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-10", amount: 30, direction: "expense", categoryId: groceries.id });

    recalculateMonth(db, "2026-01");
    recalculateMonth(db, "2026-01");

    const count = db.prepare("SELECT COUNT(*) as c FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", groceries.id) as any;
    expect(count.c).toBe(1);
  });

  it("ignores transactions without categoryId", () => {
    insertTestTransaction(db, { transactionDate: "2026-01-10", amount: 30, direction: "expense" });

    recalculateMonth(db, "2026-01");

    const count = db.prepare("SELECT COUNT(*) as c FROM monthly_aggregates WHERE month = '2026-01'").get() as any;
    expect(count.c).toBe(0);
  });
});

describe("recalculateAll", () => {
  it("recalculates all months with transactions", () => {
    const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
    insertTestTransaction(db, { transactionDate: "2026-01-10", amount: 30, direction: "expense", categoryId: groceries.id });
    insertTestTransaction(db, { transactionDate: "2026-02-10", amount: 40, direction: "expense", categoryId: groceries.id });

    recalculateAll(db);

    const jan = db.prepare("SELECT expense FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-01", groceries.id) as any;
    const feb = db.prepare("SELECT expense FROM monthly_aggregates WHERE month = ? AND categoryId = ?").get("2026-02", groceries.id) as any;
    expect(jan.expense).toBe(30);
    expect(feb.expense).toBe(40);
  });
});
