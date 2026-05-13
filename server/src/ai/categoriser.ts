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

        cache.set(batch[item.index].rawDescription, {
          merchantName: item.merchantName,
          categoryId: item.categoryId,
          direction: item.direction,
          isRecurring: item.isRecurring,
          confidence: item.confidence,
        });
      }
    } else {
      for (const t of batch) {
        result.failed.push(t.index);
      }
    }
  }

  return result;
}
