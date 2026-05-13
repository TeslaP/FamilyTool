import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { matchRules, type RuleMatch } from "../src/services/rules.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  // Get category IDs for test rules (Groceries is a child of Food, category id depends on insertion order)
  const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
  const salary = db.prepare("SELECT id FROM categories WHERE name = 'Salary'").get() as any;
  const savings = db.prepare("SELECT id FROM categories WHERE name = 'Savings'").get() as any;

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("exact", "Albert Heijn", "Albert Heijn", groceries.id, "expense", 1.0);

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("contains", "Employer BV", "Employer BV", salary.id, "income", 0.9);

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("regex", "Spaarrekening.*IBAN", "Savings Transfer", savings.id, "transfer", 0.85);
});

describe("matchRules", () => {
  it("matches exact rule", () => {
    const result = matchRules(db, "BEA Albert Heijn 1234 Amsterdam");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Albert Heijn");
    expect(result!.confidence).toBe(1.0);
  });

  it("matches contains rule", () => {
    const result = matchRules(db, "SEPA Periodieke overb. Naam: Employer BV Omschrijving: Salaris");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Employer BV");
    expect(result!.direction).toBe("income");
  });

  it("matches regex rule", () => {
    const result = matchRules(db, "SEPA Overboeking Naam: P Teslenko Omschrijving: Spaarrekening IBAN: NL12ABNA");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Savings Transfer");
    expect(result!.direction).toBe("transfer");
  });

  it("returns null when no rule matches", () => {
    const result = matchRules(db, "Unknown merchant XYZ");
    expect(result).toBeNull();
  });

  it("prefers higher confidence match", () => {
    const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;
    db.prepare(
      "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("contains", "Albert", "Albert (contains)", groceries.id, "expense", 0.9);

    const result = matchRules(db, "BEA Albert Heijn 1234 Amsterdam");
    expect(result!.merchantName).toBe("Albert Heijn");
    expect(result!.confidence).toBe(1.0);
  });

  it("increments usage count on match", () => {
    matchRules(db, "BEA Albert Heijn 1234 Amsterdam");
    matchRules(db, "BEA Albert Heijn 5678 Rotterdam");

    const rule = db.prepare("SELECT usageCount FROM categorisation_rules WHERE matchValue = ?").get("Albert Heijn") as any;
    expect(rule.usageCount).toBe(2);
  });
});
