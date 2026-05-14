import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), "../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import XLSX from "xlsx";
import OpenAI from "openai";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { runMigrations, seedCategories } from "./src/db/migrate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Setup DB
const dbPath = process.env.DB_PATH || "../data/familytool.sqlite";
const db = new Database(resolve(__dirname, "..", dbPath));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);
seedCategories(db);

// Get categories
const categories = db.prepare(`
  SELECT c.id, c.name, c.type, p.name as parentName
  FROM categories c
  LEFT JOIN categories p ON c.parentId = p.id
  WHERE c.isActive = 1 AND c.parentId IS NOT NULL
  ORDER BY c.sortOrder, c.name
`).all() as any[];

const categoryByName = new Map(categories.map((c: any) => [c.name.toLowerCase(), c.id]));

console.log("Categories loaded:", categories.length);
console.log("Sample:", categories.slice(0, 5).map((c: any) => `${c.id}: ${c.name}`));

// Read spreadsheet
const wb = XLSX.readFile(resolve(__dirname, "..", "Weekly finace planning _ Teslenko.xlsx"));
const ws = wb.Sheets["Data+category"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

function excelDateToStr(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString().slice(0, 10);
}

// Parse all rows
const records = data.slice(1)
  .filter((r) => r[0] && r[2])
  .map((r) => ({
    date: excelDateToStr(r[0]),
    amount: Math.abs(r[1]),
    direction: (r[1] >= 0 ? "income" : "expense") as "income" | "expense" | "transfer",
    description: r[2] as string,
    existingCategory: r[3] as string,
  }));

console.log(`\nParsed ${records.length} records from spreadsheet`);

// OpenAI setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const categoryList = categories.map((c: any) => `${c.id}: ${c.parentName ? c.parentName + " > " : ""}${c.name} (${c.type})`).join("\n");

async function categoriseBatch(batch: typeof records): Promise<any[]> {
  const transactionList = batch.map((r, i) => `${i}: [${r.direction === "income" ? "+" : "-"}€${r.amount.toFixed(2)}] ${r.description}`).join("\n");

  const prompt = `You are a financial transaction categoriser for a Dutch family household based in Amsterdam.

DIRECTION RULES:
- "transfer": Money between family OWN accounts. Key indicators: "PK TESLENKO", "Kopilka", "International Card Services", "INT CARD SERVICES", investment ETF purchases
- "income": Money IN from external sources (salary, freelance, child benefits, refunds, dividends)
- "expense": Money OUT to external parties

ALLOWED CATEGORIES (you MUST use one of these IDs):
${categoryList}

TRANSACTIONS:
${transactionList}

Respond with ONLY a valid JSON array. Each item: index, merchantName, categoryId, direction, isRecurring, confidence.
No markdown, no explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });

  let content = response.choices[0]?.message?.content || "[]";
  // Strip markdown fences
  content = content.trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(content);
  } catch {
    console.error("Failed to parse batch response");
    return [];
  }
}

// Import into DB
const insertFile = db.prepare("INSERT INTO import_files (fileName, rowCount, duplicateCount) VALUES (?, ?, 0)");
const insertTx = db.prepare(`
  INSERT OR IGNORE INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, merchantName, categoryId, isRecurring, fingerprint, confidence, categorisationMethod, isReviewed)
  VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'ai', 1)
`);

async function main() {
  const fileResult = insertFile.run("spreadsheet-import.xlsx", records.length);
  const fileId = Number(fileResult.lastInsertRowid);

  const batchSize = 40;
  let processed = 0;
  let imported = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\nBatch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)...`);

    const results = await categoriseBatch(batch);

    for (const result of results) {
      const idx = result.index;
      if (idx === undefined || idx >= batch.length) continue;

      const record = batch[idx];
      const fingerprint = createHash("sha256").update(`${record.date}|${record.amount}|${record.description.slice(0, 50)}`).digest("hex");

      const catId = result.categoryId && categories.find((c: any) => c.id === result.categoryId) ? result.categoryId : null;

      insertTx.run(
        fileId,
        record.date,
        record.date,
        record.amount,
        result.direction || record.direction,
        record.description,
        result.merchantName || record.description,
        catId,
        result.isRecurring ? 1 : 0,
        fingerprint,
        result.confidence || 0.8,
      );
      imported++;
    }

    processed += batch.length;
    console.log(`  → ${results.length} categorised. Total: ${imported}/${processed}`);

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  // Recalculate aggregates
  const { recalculateAll } = await import("./src/services/recalculation.js");
  recalculateAll(db);

  console.log(`\n✓ Done! Imported ${imported} transactions. Aggregates recalculated.`);
  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  db.close();
  process.exit(1);
});
