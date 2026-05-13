import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
}

export function seedCategories(db: Database.Database): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  if (existing.count > 0) return;

  const insert = db.prepare(
    "INSERT INTO categories (name, parentId, type, sortOrder) VALUES (?, ?, ?, ?)"
  );

  const insertParent = (name: string, type: string, order: number): number => {
    const result = insert.run(name, null, type, order);
    return Number(result.lastInsertRowid);
  };

  const insertChild = (name: string, parentId: number, type: string, order: number): void => {
    insert.run(name, parentId, type, order);
  };

  db.transaction(() => {
    const food = insertParent("Food", "expense", 1);
    insertChild("Groceries", food, "expense", 1);
    insertChild("Dining", food, "expense", 2);
    insertChild("Coffee", food, "expense", 3);

    const housing = insertParent("Housing", "expense", 2);
    insertChild("Mortgage", housing, "expense", 1);
    insertChild("Utilities", housing, "expense", 2);
    insertChild("Insurance (Home)", housing, "expense", 3);

    const transport = insertParent("Transport", "expense", 3);
    insertChild("Public Transport", transport, "expense", 1);
    insertChild("Fuel", transport, "expense", 2);
    insertChild("Parking", transport, "expense", 3);

    const health = insertParent("Health", "expense", 4);
    insertChild("Health Insurance", health, "expense", 1);
    insertChild("Fitness", health, "expense", 2);
    insertChild("Personal Care", health, "expense", 3);

    const children = insertParent("Children", "expense", 5);
    insertChild("Childcare", children, "expense", 1);

    const comms = insertParent("Communication", "expense", 6);
    insertChild("Telecommunications", comms, "expense", 1);

    const shopping = insertParent("Shopping", "expense", 7);
    insertChild("Online Shopping", shopping, "expense", 1);

    const leisure = insertParent("Leisure", "expense", 8);
    insertChild("Entertainment", leisure, "expense", 1);
    insertChild("Donation", leisure, "expense", 2);

    const finance = insertParent("Finance", "expense", 9);
    insertChild("Miscellaneous", finance, "expense", 1);

    const income = insertParent("Income", "income", 10);
    insertChild("Salary", income, "income", 1);
    insertChild("Freelance", income, "income", 2);
    insertChild("Refunds", income, "income", 3);

    const transfers = insertParent("Transfers", "transfer", 11);
    insertChild("Savings", transfers, "transfer", 1);
    insertChild("Investment", transfers, "transfer", 2);
    insertChild("Credit Card Payment", transfers, "transfer", 3);
  })();
}
