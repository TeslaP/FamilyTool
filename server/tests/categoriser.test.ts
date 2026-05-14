import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { buildCategorisationPrompt, getLeafCategories } from "../src/ai/prompt.js";
import { AiCache } from "../src/ai/cache.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);
});

describe("getLeafCategories", () => {
  it("returns only child categories with parent names", () => {
    const categories = getLeafCategories(db);
    expect(categories.length).toBeGreaterThan(0);
    const parents = categories.filter((c) => c.parentName === null);
    expect(parents).toHaveLength(0);
  });

  it("includes category type", () => {
    const categories = getLeafCategories(db);
    const groceries = categories.find((c) => c.name === "Groceries");
    expect(groceries).toBeDefined();
    expect(groceries!.type).toBe("expense");
  });
});

describe("buildCategorisationPrompt", () => {
  it("includes category list with IDs", () => {
    const categories = getLeafCategories(db);
    const prompt = buildCategorisationPrompt(["test transaction"], categories);
    expect(prompt).toContain("Groceries");
    expect(prompt).toContain("expense");
    expect(prompt).toContain("ALLOWED CATEGORIES");
  });

  it("includes transaction descriptions with indices", () => {
    const descriptions = ["Albert Heijn purchase", "NS train ticket"];
    const categories = getLeafCategories(db);
    const prompt = buildCategorisationPrompt(descriptions, categories);
    expect(prompt).toContain("0: Albert Heijn purchase");
    expect(prompt).toContain("1: NS train ticket");
  });

  it("instructs JSON-only response", () => {
    const categories = getLeafCategories(db);
    const prompt = buildCategorisationPrompt(["test"], categories);
    expect(prompt).toContain("ONLY a valid JSON array");
    expect(prompt).toContain("No explanation");
  });
});

describe("categoriser cache integration", () => {
  it("uses cached results to skip known descriptions", () => {
    const cache = new AiCache(db);
    cache.set("Albert Heijn purchase", {
      merchantName: "Albert Heijn",
      categoryId: 2,
      direction: "expense",
      isRecurring: false,
      confidence: 0.85,
    });

    const uncached = cache.filterUncached(["Albert Heijn purchase", "new transaction"]);
    expect(uncached).toEqual(["new transaction"]);
  });
});
