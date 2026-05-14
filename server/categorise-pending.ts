import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), "../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import Database from "better-sqlite3";
import OpenAI from "openai";
import { createHash } from "crypto";
import { runMigrations, seedCategories } from "./src/db/migrate.js";
import { buildCategorisationPrompt, getLeafCategories, getKnownRules } from "./src/ai/prompt.js";
import { validateAiResponse } from "./src/ai/validator.js";
import { AiCache } from "./src/ai/cache.js";
import { recalculateAll } from "./src/services/recalculation.js";

const db = new Database("./data/familytool.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);
seedCategories(db);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.AI_MODEL || "gpt-4o-mini";

const uncategorised = db.prepare(
  "SELECT id, rawDescription FROM transactions WHERE categorisationMethod IS NULL"
).all() as { id: number; rawDescription: string }[];

console.log(`Uncategorised: ${uncategorised.length}`);
if (uncategorised.length === 0) { console.log("Nothing to do."); db.close(); process.exit(0); }

const categories = getLeafCategories(db);
const validCategoryIds = categories.map(c => c.id);
const cache = new AiCache(db);
const knownRules = getKnownRules(db);

const update = db.prepare(
  "UPDATE transactions SET merchantName = ?, categoryId = ?, direction = ?, isRecurring = ?, confidence = ?, categorisationMethod = 'ai' WHERE id = ?"
);
const fail = db.prepare("UPDATE transactions SET categorisationMethod = 'failed' WHERE id = ?");

let done = 0;
let failed = 0;
const batchSize = 30; // smaller batches for reliability

for (let i = 0; i < uncategorised.length; i += batchSize) {
  const batch = uncategorised.slice(i, i + batchSize);
  const batchNum = Math.floor(i / batchSize) + 1;
  const totalBatches = Math.ceil(uncategorised.length / batchSize);

  // Check cache first
  const uncached: typeof batch = [];
  for (const t of batch) {
    const cached = cache.get(t.rawDescription);
    if (cached) {
      update.run(cached.merchantName, cached.categoryId, cached.direction, cached.isRecurring ? 1 : 0, cached.confidence, t.id);
      done++;
    } else {
      uncached.push(t);
    }
  }

  if (uncached.length === 0) {
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} cached. Total: ${done}/${uncategorised.length}`);
    continue;
  }

  const descriptions = uncached.map(t => t.rawDescription);
  const prompt = buildCategorisationPrompt(descriptions, categories, knownRules);

  let success = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }, { timeout: 60000 });

      let content = response.choices[0]?.message?.content || "";
      content = content.trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const validation = validateAiResponse(content, uncached.length, validCategoryIds);
      if (validation.valid && validation.items) {
        for (const item of validation.items) {
          const t = uncached[item.index];
          update.run(item.merchantName, item.categoryId, item.direction, item.isRecurring ? 1 : 0, item.confidence, t.id);
          cache.set(t.rawDescription, {
            merchantName: item.merchantName,
            categoryId: item.categoryId,
            direction: item.direction,
            isRecurring: item.isRecurring,
            confidence: item.confidence,
          });
          done++;
        }
        success = true;
        break;
      }
    } catch (err: any) {
      if (attempt === 0) continue;
    }
  }

  if (!success) {
    for (const t of uncached) { fail.run(t.id); failed++; }
  }

  console.log(`Batch ${batchNum}/${totalBatches}: ${success ? "OK" : "FAILED"}. Total: ${done}/${uncategorised.length}`);
}

recalculateAll(db);
console.log(`✓ Done: ${done} categorised, ${failed} failed`);
db.close();
