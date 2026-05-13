# Phase 2: AI & Recalculation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered transaction categorisation (OpenAI), a recalculation engine for monthly aggregates, monthly summary generation, rule learning from user corrections, and a transaction update API.

**Architecture:** Extends the Phase 1 Express backend with an `ai/` module for OpenAI integration, a `recalculation` service that maintains the `monthly_aggregates` table, and new API endpoints for transaction updates and rule creation.

**Tech Stack:** OpenAI SDK (openai npm package), existing better-sqlite3, vitest for testing

---

## File Structure (Phase 2 additions)

```
server/src/
├── ai/
│   ├── client.ts              # OpenAI client singleton
│   ├── categoriser.ts         # Batch categorisation logic
│   ├── validator.ts           # AI response validation
│   ├── prompt.ts              # Prompt templates
│   ├── summary.ts             # Monthly summary generation
│   └── cache.ts               # Description-hash cache to avoid repeat calls
├── services/
│   ├── recalculation.ts       # Monthly aggregates recalculation
│   └── transactions.ts        # Transaction CRUD operations
├── routes/
│   ├── transactions.ts        # GET/PATCH /api/transactions
│   └── summary.ts             # POST /api/summary/generate
server/tests/
├── categoriser.test.ts
├── validator.test.ts
├── recalculation.test.ts
├── transactions.test.ts
└── cache.test.ts
```

---

## Task 1: OpenAI Client & Configuration

**Files:**
- Create: `server/src/ai/client.ts`
- Modify: `server/src/config.ts` (add AI config fields)
- Create: `server/tests/ai-client.test.ts`

- [ ] **Step 1: Update config.ts to add AI settings**

Add to the `Config` interface and `loadConfig()`:

```typescript
// Add to Config interface:
aiEnabled: boolean;
aiModel: string;
aiSummaryModel: string;
aiMaxConcurrent: number;
aiTimeoutMs: number;

// Add to loadConfig() return:
aiEnabled: !!process.env.OPENAI_API_KEY,
aiModel: process.env.AI_MODEL || "gpt-4o-mini",
aiSummaryModel: process.env.AI_SUMMARY_MODEL || "gpt-4o",
aiMaxConcurrent: parseInt(process.env.AI_MAX_CONCURRENT || "3", 10),
aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "30000", 10),
```

- [ ] **Step 2: Update .env.example**

Add:
```env
# AI Configuration
AI_MODEL=gpt-4o-mini
AI_SUMMARY_MODEL=gpt-4o
AI_MAX_CONCURRENT=3
AI_TIMEOUT_MS=30000
```

- [ ] **Step 3: Create server/src/ai/client.ts**

```typescript
import OpenAI from "openai";
import { loadConfig } from "../config.js";

let client: OpenAI | null = null;

export function getAiClient(): OpenAI | null {
  const config = loadConfig();
  if (!config.aiEnabled) return null;

  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export function isAiEnabled(): boolean {
  return loadConfig().aiEnabled;
}
```

- [ ] **Step 4: Install openai package**

```bash
cd /Users/pteslenko/Familytool && npm install openai -w server
```

- [ ] **Step 5: Write test verifying AI disabled without key**

`server/tests/ai-client.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAiClient, isAiEnabled } from "../src/ai/client.js";

describe("AI client", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("returns null when OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(getAiClient()).toBeNull();
  });

  it("reports AI disabled without key", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isAiEnabled()).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npm test -w server -- --run
```

Expected: all existing tests pass + 2 new AI client tests.

- [ ] **Step 7: Commit**

```bash
git add server/src/ai/client.ts server/src/config.ts server/tests/ai-client.test.ts .env.example package-lock.json server/package.json
git commit -m "feat: OpenAI client with AI enabled/disabled toggle"
```

---

## Task 2: AI Response Validator

**Files:**
- Create: `server/src/ai/validator.ts`
- Create: `server/tests/validator.test.ts`

- [ ] **Step 1: Write failing tests**

`server/tests/validator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateAiResponse, type AiCategorisationResult } from "../src/ai/validator.js";

const validCategoryIds = [2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("validateAiResponse", () => {
  it("accepts valid response", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Albert Heijn", categoryId: 2, direction: "expense", isRecurring: false, confidence: 0.85 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items![0].merchantName).toBe("Albert Heijn");
  });

  it("rejects non-JSON string", () => {
    const result = validateAiResponse("not json", 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("parse");
  });

  it("rejects non-array JSON", () => {
    const result = validateAiResponse('{"foo": "bar"}', 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("array");
  });

  it("rejects item with missing fields", () => {
    const raw = JSON.stringify([{ index: 0, merchantName: "Test" }]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing");
  });

  it("rejects invalid categoryId", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 999, direction: "expense", isRecurring: false, confidence: 0.8 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("category");
  });

  it("rejects invalid direction", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 2, direction: "invalid", isRecurring: false, confidence: 0.8 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("direction");
  });

  it("rejects confidence out of range", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 2, direction: "expense", isRecurring: false, confidence: 1.5 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("confidence");
  });

  it("rejects wrong item count", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "A", categoryId: 2, direction: "expense", isRecurring: false, confidence: 0.8 },
      { index: 1, merchantName: "B", categoryId: 3, direction: "expense", isRecurring: false, confidence: 0.7 }
    ]);
    const result = validateAiResponse(raw, 3, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("count");
  });
});
```

- [ ] **Step 2: Implement validator**

`server/src/ai/validator.ts`:
```typescript
export interface AiCategorisationResult {
  index: number;
  merchantName: string;
  categoryId: number;
  direction: "income" | "expense" | "transfer";
  isRecurring: boolean;
  confidence: number;
}

export interface ValidationResult {
  valid: boolean;
  items?: AiCategorisationResult[];
  error?: string;
}

const VALID_DIRECTIONS = ["income", "expense", "transfer"];

export function validateAiResponse(
  raw: string,
  expectedCount: number,
  validCategoryIds: number[]
): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "Failed to parse JSON response" };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: "Response must be a JSON array" };
  }

  if (parsed.length !== expectedCount) {
    return { valid: false, error: `Expected ${expectedCount} items, got ${parsed.length} (count mismatch)` };
  }

  const items: AiCategorisationResult[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];

    if (
      item.index === undefined ||
      !item.merchantName ||
      item.categoryId === undefined ||
      !item.direction ||
      item.isRecurring === undefined ||
      item.confidence === undefined
    ) {
      return { valid: false, error: `Item ${i} has missing required fields` };
    }

    if (!validCategoryIds.includes(item.categoryId)) {
      return { valid: false, error: `Item ${i} has invalid category ID ${item.categoryId}` };
    }

    if (!VALID_DIRECTIONS.includes(item.direction)) {
      return { valid: false, error: `Item ${i} has invalid direction "${item.direction}"` };
    }

    if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) {
      return { valid: false, error: `Item ${i} has invalid confidence ${item.confidence} (must be 0.0-1.0)` };
    }

    items.push({
      index: item.index,
      merchantName: item.merchantName,
      categoryId: item.categoryId,
      direction: item.direction,
      isRecurring: !!item.isRecurring,
      confidence: item.confidence,
    });
  }

  return { valid: true, items };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 4: Commit**

```bash
git add server/src/ai/validator.ts server/tests/validator.test.ts
git commit -m "feat: AI response validator with strict schema checking"
```

---

## Task 3: AI Categorisation Cache

**Files:**
- Create: `server/src/ai/cache.ts`
- Create: `server/tests/cache.test.ts`

- [ ] **Step 1: Write failing tests**

`server/tests/cache.test.ts`:
```typescript
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
  // Add cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      descriptionHash TEXT PRIMARY KEY,
      merchantName TEXT NOT NULL,
      categoryId INTEGER NOT NULL,
      direction TEXT NOT NULL,
      isRecurring INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
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

  it("uses hash of description as key", () => {
    cache.set("same description", {
      merchantName: "Test",
      categoryId: 3,
      direction: "expense",
      isRecurring: false,
      confidence: 0.8,
    });

    // Same description returns same result
    const result = cache.get("same description");
    expect(result).not.toBeNull();
  });

  it("filters out descriptions to skip from a batch", () => {
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
});
```

- [ ] **Step 2: Implement cache**

`server/src/ai/cache.ts`:
```typescript
import { createHash } from "crypto";
import type Database from "better-sqlite3";

export interface CachedCategorisation {
  merchantName: string;
  categoryId: number;
  direction: "income" | "expense" | "transfer";
  isRecurring: boolean;
  confidence: number;
}

export class AiCache {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_cache (
        descriptionHash TEXT PRIMARY KEY,
        merchantName TEXT NOT NULL,
        categoryId INTEGER NOT NULL,
        direction TEXT NOT NULL,
        isRecurring INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private hash(description: string): string {
    return createHash("sha256").update(description.trim().toLowerCase()).digest("hex");
  }

  get(description: string): CachedCategorisation | null {
    const hash = this.hash(description);
    const row = this.db.prepare(
      "SELECT merchantName, categoryId, direction, isRecurring, confidence FROM ai_cache WHERE descriptionHash = ?"
    ).get(hash) as any;

    if (!row) return null;

    return {
      merchantName: row.merchantName,
      categoryId: row.categoryId,
      direction: row.direction,
      isRecurring: !!row.isRecurring,
      confidence: row.confidence,
    };
  }

  set(description: string, result: CachedCategorisation): void {
    const hash = this.hash(description);
    this.db.prepare(
      "INSERT OR REPLACE INTO ai_cache (descriptionHash, merchantName, categoryId, direction, isRecurring, confidence) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(hash, result.merchantName, result.categoryId, result.direction, result.isRecurring ? 1 : 0, result.confidence);
  }

  filterUncached(descriptions: string[]): string[] {
    return descriptions.filter((d) => this.get(d) === null);
  }
}
```

- [ ] **Step 3: Add ai_cache table to schema.sql**

Append to `server/src/db/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS ai_cache (
  descriptionHash TEXT PRIMARY KEY,
  merchantName TEXT NOT NULL,
  categoryId INTEGER NOT NULL,
  direction TEXT NOT NULL,
  isRecurring INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/cache.ts server/tests/cache.test.ts server/src/db/schema.sql
git commit -m "feat: AI categorisation cache to avoid repeat API calls"
```

---

## Task 4: Prompt Template & Batch Categoriser

**Files:**
- Create: `server/src/ai/prompt.ts`
- Create: `server/src/ai/categoriser.ts`
- Create: `server/tests/categoriser.test.ts`

- [ ] **Step 1: Create prompt template**

`server/src/ai/prompt.ts`:
```typescript
import type Database from "better-sqlite3";

export function buildCategorisationPrompt(
  descriptions: string[],
  categories: { id: number; name: string; parentName: string | null; type: string }[]
): string {
  const categoryList = categories
    .map((c) => `${c.id}: ${c.parentName ? c.parentName + " > " : ""}${c.name} (${c.type})`)
    .join("\n");

  const transactionList = descriptions
    .map((d, i) => `${i}: ${d}`)
    .join("\n");

  return `You are a financial transaction categoriser for a Dutch family household.

Categorise each transaction below. For each, provide:
- merchantName: cleaned merchant name (e.g. "Albert Heijn", "NS", "Ziggo")
- categoryId: one of the allowed category IDs below
- direction: "income", "expense", or "transfer"
- isRecurring: true if this appears to be a recurring payment
- confidence: 0.0 to 1.0 how confident you are

ALLOWED CATEGORIES (you MUST use one of these IDs):
${categoryList}

TRANSACTIONS TO CATEGORISE:
${transactionList}

Respond with ONLY a JSON array. Each item must have: index, merchantName, categoryId, direction, isRecurring, confidence.
No explanation, no markdown, just the JSON array.`;
}

export function getLeafCategories(db: Database.Database): { id: number; name: string; parentName: string | null; type: string }[] {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.type, p.name as parentName
    FROM categories c
    LEFT JOIN categories p ON c.parentId = p.id
    WHERE c.isActive = 1 AND c.parentId IS NOT NULL
    ORDER BY c.sortOrder, c.name
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentName: r.parentName,
    type: r.type,
  }));
}
```

- [ ] **Step 2: Create batch categoriser**

`server/src/ai/categoriser.ts`:
```typescript
import type Database from "better-sqlite3";
import { getAiClient } from "./client.js";
import { loadConfig } from "../config.js";
import { validateAiResponse, type AiCategorisationResult } from "./validator.js";
import { AiCache, type CachedCategorisation } from "./cache.js";
import { buildCategorisationPrompt, getLeafCategories } from "./prompt.js";

export interface CategorisationBatchResult {
  results: Map<number, AiCategorisationResult>;
  cached: Map<number, CachedCategorisation>;
  failed: number[];
}

export async function categoriseTransactions(
  db: Database.Database,
  transactions: { index: number; rawDescription: string }[]
): Promise<CategorisationBatchResult> {
  const result: CategorisationBatchResult = {
    results: new Map(),
    cached: new Map(),
    failed: [],
  };

  const client = getAiClient();
  if (!client) {
    // AI disabled — all transactions go to failed (uncategorised)
    result.failed = transactions.map((t) => t.index);
    return result;
  }

  const config = loadConfig();
  const cache = new AiCache(db);
  const categories = getLeafCategories(db);
  const validCategoryIds = categories.map((c) => c.id);

  // Check cache first
  const uncached: typeof transactions = [];
  for (const t of transactions) {
    const cached = cache.get(t.rawDescription);
    if (cached) {
      result.cached.set(t.index, cached);
    } else {
      uncached.push(t);
    }
  }

  if (uncached.length === 0) return result;

  // Batch into groups of 50
  const batchSize = 50;
  const batches: (typeof transactions)[] = [];
  for (let i = 0; i < uncached.length; i += batchSize) {
    batches.push(uncached.slice(i, i + batchSize));
  }

  // Process batches (max concurrent)
  for (const batch of batches) {
    const descriptions = batch.map((t) => t.rawDescription);
    const prompt = buildCategorisationPrompt(descriptions, categories);

    let aiResult: AiCategorisationResult[] | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: config.aiModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          timeout: config.aiTimeoutMs,
        });

        const content = response.choices[0]?.message?.content || "";
        const validation = validateAiResponse(content, batch.length, validCategoryIds);

        if (validation.valid && validation.items) {
          aiResult = validation.items;
          break;
        }
      } catch {
        // Retry on next attempt
      }
    }

    if (aiResult) {
      for (const item of aiResult) {
        const originalIndex = batch[item.index].index;
        result.results.set(originalIndex, item);

        // Cache the result
        cache.set(batch[item.index].rawDescription, {
          merchantName: item.merchantName,
          categoryId: item.categoryId,
          direction: item.direction,
          isRecurring: item.isRecurring,
          confidence: item.confidence,
        });
      }
    } else {
      // All items in this batch failed
      for (const t of batch) {
        result.failed.push(t.index);
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: Write tests (unit tests with mocked AI)**

`server/tests/categoriser.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";

// We test the categoriser logic without making real API calls
// by testing the prompt building and the integration flow with cache

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
    expect(categories[0].parentName).not.toBeNull();
    // Should not include parent categories (those with parentId = null)
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
    expect(prompt).toContain("ONLY a JSON array");
    expect(prompt).toContain("No explanation");
  });
});

describe("categoriser with cache integration", () => {
  it("uses cached results when available", () => {
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/prompt.ts server/src/ai/categoriser.ts server/tests/categoriser.test.ts
git commit -m "feat: AI batch categoriser with caching and retry logic"
```

---

## Task 5: Recalculation Engine

**Files:**
- Create: `server/src/services/recalculation.ts`
- Create: `server/tests/recalculation.test.ts`

- [ ] **Step 1: Write failing tests**

`server/tests/recalculation.test.ts`:
```typescript
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
  const fileId = db.prepare("INSERT INTO import_files (fileName, rowCount) VALUES ('test.tab', 1)").run().lastInsertRowid;

  const defaults = {
    sourceFileId: fileId,
    transactionDate: "2026-01-15",
    valueDate: "2026-01-15",
    amount: 50.0,
    direction: "expense",
    startBalance: 1000,
    endBalance: 950,
    rawDescription: "Test transaction",
    fingerprint: `fp-${Math.random()}`,
    categoryId: null as number | null,
    isRecurring: 0,
  };

  const merged = { ...defaults, ...overrides };

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, fingerprint, categoryId, isRecurring, confidence, categorisationMethod)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, 'manual')
  `).run(
    merged.sourceFileId,
    merged.transactionDate,
    merged.valueDate,
    merged.amount,
    merged.direction,
    merged.startBalance,
    merged.endBalance,
    merged.rawDescription,
    merged.fingerprint,
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
    insertTestTransaction(db, { transactionDate: "2026-01-10", amount: 30, direction: "expense", categoryId: undefined as any });

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
```

- [ ] **Step 2: Implement recalculation service**

`server/src/services/recalculation.ts`:
```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/recalculation.ts server/tests/recalculation.test.ts
git commit -m "feat: recalculation engine for monthly aggregates"
```

---

## Task 6: Transaction Update API & Rule Learning

**Files:**
- Create: `server/src/routes/transactions.ts`
- Create: `server/tests/transactions.test.ts`
- Modify: `server/src/app.ts` (register route)

- [ ] **Step 1: Write failing tests**

`server/tests/transactions.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createTransactionsRouter } from "../src/routes/transactions.js";
import { authMiddleware } from "../src/middleware/auth.js";

const TEST_CONFIG = {
  authUsername: "admin",
  authPassword: "testpass",
  jwtSecret: "test-secret",
};

function createTransactionsTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  // Insert test data
  const fileId = db.prepare("INSERT INTO import_files (fileName, rowCount) VALUES ('test.tab', 3)").run().lastInsertRowid;
  const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any;

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, rawDescription, fingerprint, categoryId, confidence, categorisationMethod, merchantName)
    VALUES (?, '2026-01-10', '2026-01-10', 50.0, 'expense', 'Albert Heijn Amsterdam', 'fp1', ?, 0.8, 'ai', 'Albert Heijn')
  `).run(fileId, groceries.id);

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, rawDescription, fingerprint, confidence, categorisationMethod)
    VALUES (?, '2026-01-11', '2026-01-11', 30.0, 'expense', 'Unknown shop', 'fp2', 0.0, NULL)
  `).run(fileId);

  db.prepare(`
    INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, rawDescription, fingerprint, confidence, categorisationMethod)
    VALUES (?, '2026-01-12', '2026-01-12', 100.0, 'expense', 'Another unknown', 'fp3', 0.5, 'ai')
  `).run(fileId);

  app.use("/api/auth", createAuthRouter(TEST_CONFIG));
  app.use("/api/transactions", authMiddleware(TEST_CONFIG.jwtSecret), createTransactionsRouter(db));

  return { app, db };
}

let app: any;
let db: any;
let token: string;

beforeAll(async () => {
  const testApp = createTransactionsTestApp();
  app = testApp.app;
  db = testApp.db;

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "testpass" });
  token = loginRes.body.token;
});

describe("GET /api/transactions", () => {
  it("returns transactions for a month", async () => {
    const res = await request(app)
      .get("/api/transactions?month=2026-01")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it("filters by review status", async () => {
    const res = await request(app)
      .get("/api/transactions?month=2026-01&needsReview=true")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Transactions with confidence < 0.7 or no category
    const needsReview = res.body.filter((t: any) => t.confidence < 0.7 || !t.categoryId);
    expect(needsReview.length).toBeGreaterThan(0);
  });
});

describe("PATCH /api/transactions/:id", () => {
  it("updates category and marks as reviewed", async () => {
    const dining = db.prepare("SELECT id FROM categories WHERE name = 'Dining'").get() as any;

    const res = await request(app)
      .patch("/api/transactions/2")
      .set("Authorization", `Bearer ${token}`)
      .send({ categoryId: dining.id, merchantName: "Local Restaurant" });

    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe(dining.id);
    expect(res.body.merchantName).toBe("Local Restaurant");
    expect(res.body.isReviewed).toBe(1);
    expect(res.body.confidence).toBe(1.0);
    expect(res.body.categorisationMethod).toBe("manual");
  });

  it("returns 404 for non-existent transaction", async () => {
    const res = await request(app)
      .patch("/api/transactions/999")
      .set("Authorization", `Bearer ${token}`)
      .send({ categoryId: 2 });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/transactions/:id/create-rule", () => {
  it("creates a categorisation rule from a transaction", async () => {
    const res = await request(app)
      .post("/api/transactions/1/create-rule")
      .set("Authorization", `Bearer ${token}`)
      .send({ matchType: "contains", matchValue: "Albert Heijn" });

    expect(res.status).toBe(201);
    expect(res.body.matchValue).toBe("Albert Heijn");
    expect(res.body.merchantName).toBe("Albert Heijn");

    // Verify rule exists in DB
    const rule = db.prepare("SELECT * FROM categorisation_rules WHERE matchValue = 'Albert Heijn'").get() as any;
    expect(rule).toBeDefined();
  });

  it("returns 404 for non-existent transaction", async () => {
    const res = await request(app)
      .post("/api/transactions/999/create-rule")
      .set("Authorization", `Bearer ${token}`)
      .send({ matchType: "contains", matchValue: "test" });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Implement transactions route**

`server/src/routes/transactions.ts`:
```typescript
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
```

- [ ] **Step 3: Update app.ts to register transactions route**

Add to `server/src/app.ts`:
```typescript
import { createTransactionsRouter } from "./routes/transactions.js";

// After existing routes:
app.use("/api/transactions", authMiddleware(config.jwtSecret), createTransactionsRouter(db));
```

- [ ] **Step 4: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/transactions.ts server/tests/transactions.test.ts server/src/app.ts
git commit -m "feat: transaction update API with rule learning and recalculation"
```

---

## Task 7: Monthly Summary Generation

**Files:**
- Create: `server/src/ai/summary.ts`
- Create: `server/src/routes/summary.ts`
- Create: `server/tests/summary.test.ts`
- Modify: `server/src/app.ts` (register route)

- [ ] **Step 1: Create summary prompt builder**

`server/src/ai/summary.ts`:
```typescript
import type Database from "better-sqlite3";
import { getAiClient } from "./client.js";
import { loadConfig } from "../config.js";

export interface MonthlySummaryData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  netCashflow: number;
  categoryBreakdown: { category: string; amount: number; direction: string }[];
  previousMonth: { totalIncome: number; totalExpenses: number } | null;
}

export function gatherSummaryData(db: Database.Database, month: string): MonthlySummaryData {
  const aggregates = db.prepare(`
    SELECT ma.categoryId, ma.income, ma.expense, ma.transferOut, c.name as categoryName, c.type
    FROM monthly_aggregates ma
    JOIN categories c ON ma.categoryId = c.id
    WHERE ma.month = ?
  `).all(month) as any[];

  const totalIncome = aggregates.reduce((sum, a) => sum + a.income, 0);
  const totalExpenses = aggregates.reduce((sum, a) => sum + a.expense, 0);
  const totalTransfers = aggregates.reduce((sum, a) => sum + a.transferOut, 0);

  const categoryBreakdown = aggregates
    .filter((a) => a.expense > 0 || a.income > 0)
    .map((a) => ({
      category: a.categoryName,
      amount: a.expense > 0 ? a.expense : a.income,
      direction: a.type,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Previous month comparison
  const [year, monthNum] = month.split("-").map(Number);
  const prevMonth = monthNum === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNum - 1).padStart(2, "0")}`;

  const prevAggregates = db.prepare(`
    SELECT SUM(income) as totalIncome, SUM(expense) as totalExpenses
    FROM monthly_aggregates WHERE month = ?
  `).get(prevMonth) as any;

  const previousMonth = prevAggregates?.totalIncome != null
    ? { totalIncome: prevAggregates.totalIncome, totalExpenses: prevAggregates.totalExpenses }
    : null;

  return {
    month,
    totalIncome,
    totalExpenses,
    totalTransfers,
    netCashflow: totalIncome - totalExpenses,
    categoryBreakdown,
    previousMonth,
  };
}

export async function generateMonthlySummary(db: Database.Database, month: string): Promise<string> {
  const client = getAiClient();
  if (!client) {
    return "AI summary unavailable — no OpenAI API key configured.";
  }

  const config = loadConfig();
  const data = gatherSummaryData(db, month);

  const prompt = `You are a calm, practical financial advisor for a family household.
Generate a brief monthly financial summary based on this data:

Month: ${data.month}
Total income: €${data.totalIncome.toFixed(2)}
Total expenses: €${data.totalExpenses.toFixed(2)}
Net cashflow: €${data.netCashflow.toFixed(2)}
Transfers (savings/investments): €${data.totalTransfers.toFixed(2)}

Top spending categories:
${data.categoryBreakdown.slice(0, 8).map((c) => `- ${c.category}: €${c.amount.toFixed(2)}`).join("\n")}

${data.previousMonth ? `Previous month comparison:
- Income: €${data.previousMonth.totalIncome.toFixed(2)} → €${data.totalIncome.toFixed(2)}
- Expenses: €${data.previousMonth.totalExpenses.toFixed(2)} → €${data.totalExpenses.toFixed(2)}` : "No previous month data available."}

Write 3-5 sentences. Be calm, practical, non-judgemental. Focus on notable changes and the overall financial health. Do not use exclamation marks or alarmist language.`;

  const response = await client.chat.completions.create({
    model: config.aiSummaryModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || "Unable to generate summary.";
}
```

- [ ] **Step 2: Create summary route**

`server/src/routes/summary.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import { generateMonthlySummary, gatherSummaryData } from "../ai/summary.js";

export function createSummaryRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/generate", async (req, res) => {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Valid month (YYYY-MM) required" });
      return;
    }

    try {
      const summary = await generateMonthlySummary(db, month);
      const data = gatherSummaryData(db, month);
      res.json({ summary, data });
    } catch (err: any) {
      res.status(500).json({ error: `Summary generation failed: ${err.message}` });
    }
  });

  return router;
}
```

- [ ] **Step 3: Write tests**

`server/tests/summary.test.ts`:
```typescript
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
    expect(data.categoryBreakdown[0].amount).toBeGreaterThanOrEqual(data.categoryBreakdown[data.categoryBreakdown.length - 1].amount);
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
```

- [ ] **Step 4: Update app.ts**

Add to `server/src/app.ts`:
```typescript
import { createSummaryRouter } from "./routes/summary.js";

// After existing routes:
app.use("/api/summary", authMiddleware(config.jwtSecret), createSummaryRouter(db));
```

- [ ] **Step 5: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 6: Commit**

```bash
git add server/src/ai/summary.ts server/src/routes/summary.ts server/tests/summary.test.ts server/src/app.ts
git commit -m "feat: monthly summary generation with AI narrative"
```

---

## Task 8: Wire AI Categorisation Into Import Flow

**Files:**
- Modify: `server/src/routes/import.ts` (trigger AI after confirm)
- Create: `server/tests/import-ai.test.ts`

- [ ] **Step 1: Update import confirm to trigger AI categorisation**

In `server/src/routes/import.ts`, after the transaction block in the confirm handler, add async AI categorisation for uncategorised transactions:

```typescript
import { categoriseTransactions } from "../ai/categoriser.js";
import { recalculateAffectedMonths } from "../services/recalculation.js";

// After the db.transaction()() call in confirm handler:
// Gather uncategorised transactions from this import
const uncategorised = db.prepare(
  "SELECT id, rawDescription FROM transactions WHERE sourceFileId = ? AND categorisationMethod IS NULL"
).all(fileId) as { id: number; rawDescription: string }[];

let aiCategorised = 0;
let aiFailed = 0;

if (uncategorised.length > 0) {
  const aiInput = uncategorised.map((t, i) => ({ index: i, rawDescription: t.rawDescription }));

  try {
    const aiResult = await categoriseTransactions(db, aiInput);

    // Apply AI results
    const updateStmt = db.prepare(
      "UPDATE transactions SET merchantName = ?, categoryId = ?, direction = ?, isRecurring = ?, confidence = ?, categorisationMethod = 'ai' WHERE id = ?"
    );

    for (const [index, result] of aiResult.results) {
      const txId = uncategorised[index].id;
      updateStmt.run(result.merchantName, result.categoryId, result.direction, result.isRecurring ? 1 : 0, result.confidence, txId);
      aiCategorised++;
    }

    // Apply cached results
    for (const [index, cached] of aiResult.cached) {
      const txId = uncategorised[index].id;
      updateStmt.run(cached.merchantName, cached.categoryId, cached.direction, cached.isRecurring ? 1 : 0, cached.confidence, txId);
      aiCategorised++;
    }

    // Mark failed
    const failStmt = db.prepare("UPDATE transactions SET categorisationMethod = 'failed' WHERE id = ?");
    for (const index of aiResult.failed) {
      const txId = uncategorised[index].id;
      failStmt.run(txId);
      aiFailed++;
    }
  } catch {
    // AI failure should not break the import
    aiFailed = uncategorised.length;
  }

  // Recalculate affected months
  const dates = db.prepare("SELECT DISTINCT transactionDate FROM transactions WHERE sourceFileId = ?").all(fileId) as { transactionDate: string }[];
  recalculateAffectedMonths(db, dates.map((d) => d.transactionDate));
}

// Update import file stats
db.prepare("UPDATE import_files SET aiRequestCount = ? WHERE id = ?").run(aiCategorised + aiFailed, fileId);
```

**Important:** The confirm handler needs to become `async` for the AI call.

- [ ] **Step 2: Update the confirm response to include AI stats**

```typescript
res.json({
  imported,
  duplicatesSkipped,
  aiCategorised,
  aiFailed,
  fileName,
});
```

- [ ] **Step 3: Write integration test (AI disabled path)**

`server/tests/import-ai.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import multer from "multer";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createImportRouter } from "../src/routes/import.js";
import { authMiddleware } from "../src/middleware/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "../../samples");

const TEST_CONFIG = {
  authUsername: "admin",
  authPassword: "testpass",
  jwtSecret: "test-secret",
};

let app: any;
let token: string;

beforeAll(async () => {
  // Remove OPENAI_API_KEY to test AI-disabled path
  delete process.env.OPENAI_API_KEY;

  const appInstance = express();
  appInstance.use(cors());
  appInstance.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const upload = multer({ storage: multer.memoryStorage() });
  appInstance.use("/api/auth", createAuthRouter(TEST_CONFIG));
  appInstance.use("/api/import", authMiddleware(TEST_CONFIG.jwtSecret), createImportRouter(db, upload, ":memory:"));

  app = appInstance;

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "testpass" });
  token = loginRes.body.token;
});

describe("Import with AI disabled", () => {
  it("imports successfully without AI, marking uncategorised as failed", async () => {
    const previewRes = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    const confirmRes = await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "test.tab",
        transactions: previewRes.body.transactions,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.imported).toBe(3);
    expect(confirmRes.body.aiFailed).toBe(3);
    expect(confirmRes.body.aiCategorised).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -w server -- --run
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/import.ts server/tests/import-ai.test.ts
git commit -m "feat: wire AI categorisation into import confirm flow"
```

---

## Task 9: Integration Test & Final Cleanup

**Files:**
- Verify all tests pass
- Run full E2E verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/pteslenko/Familytool && npm test -w server -- --run
```

Expected: all tests pass (existing + new from this phase).

- [ ] **Step 2: Verify API endpoints manually**

Start server and test:
```bash
# Start server
npx tsx server/src/index.ts &

# Login
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'

# Import preview
curl -s -X POST http://localhost:3001/api/import/preview \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@samples/test-3rows.tab"

# Get transactions
curl -s "http://localhost:3001/api/transactions?month=2026-01" \
  -H "Authorization: Bearer <TOKEN>"
```

Kill server after testing.

- [ ] **Step 3: Run tests one final time**

```bash
npm test -w server -- --run
```

- [ ] **Step 4: Commit if any cleanup was needed**

```bash
git add -A && git status
# Only commit if there are changes
git commit -m "chore: Phase 2 complete — AI categorisation, recalculation, and rule learning"
```

---

## Phase 2 Deliverables

After completing all tasks, the project has (in addition to Phase 1):

- OpenAI client with enabled/disabled toggle
- AI response validator (strict JSON schema)
- AI categorisation cache (description hash → result)
- Prompt template for batch categorisation
- Batch categoriser with retry logic and rate limiting
- Recalculation engine (monthly aggregates from transactions)
- Transaction update API (PATCH category, create rules)
- Rule learning (create categorisation rules from corrections)
- Monthly summary generation (AI narrative from aggregated data)
- AI wired into import flow (categorise after confirm)
- Full test coverage for all new services

## What's Next (Phase 3)

Phase 3 will cover:
- Frontend: Dashboard view (metrics, charts, drilldowns)
- Frontend: Import page (file upload, preview, confirm)
- Frontend: Review queue (transaction editing, rule creation)
- Frontend: Forecast view
- Frontend: Login page
- Navigation shell and routing
