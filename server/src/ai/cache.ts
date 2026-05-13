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
  constructor(private db: Database.Database) {}

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
