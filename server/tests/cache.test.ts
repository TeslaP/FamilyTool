import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../src/db/migrate.js";
import { AiCache } from "../src/ai/cache.js";

let db: Database.Database;
let cache: AiCache;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  cache = new AiCache(db);
});

describe("AiCache", () => {
  it("returns null for unknown description", () => {
    const result = cache.get("unknown transaction description");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached result", () => {
    cache.set("Albert Heijn groceries", {
      merchantName: "Albert Heijn",
      categoryId: 2,
      direction: "expense",
      isRecurring: false,
      confidence: 0.85,
    });

    const result = cache.get("Albert Heijn groceries");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Albert Heijn");
    expect(result!.confidence).toBe(0.85);
  });

  it("is case-insensitive for lookup", () => {
    cache.set("Albert Heijn purchase", {
      merchantName: "Albert Heijn",
      categoryId: 2,
      direction: "expense",
      isRecurring: false,
      confidence: 0.85,
    });

    const result = cache.get("albert heijn purchase");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Albert Heijn");
  });

  it("filters out cached descriptions from a batch", () => {
    cache.set("known description", {
      merchantName: "Known",
      categoryId: 2,
      direction: "expense",
      isRecurring: false,
      confidence: 0.8,
    });

    const descriptions = ["known description", "new description", "another new one"];
    const uncached = cache.filterUncached(descriptions);
    expect(uncached).toEqual(["new description", "another new one"]);
  });

  it("overwrites existing cache entry on set", () => {
    cache.set("test transaction", {
      merchantName: "Old",
      categoryId: 2,
      direction: "expense",
      isRecurring: false,
      confidence: 0.5,
    });

    cache.set("test transaction", {
      merchantName: "New",
      categoryId: 3,
      direction: "expense",
      isRecurring: true,
      confidence: 0.9,
    });

    const result = cache.get("test transaction");
    expect(result!.merchantName).toBe("New");
    expect(result!.confidence).toBe(0.9);
  });
});
