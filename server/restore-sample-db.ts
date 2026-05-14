import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), "../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { runMigrations, seedCategories } from "./src/db/migrate.js";
import { recalculateAll } from "./src/services/recalculation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || "./data/familytool.sqlite";
const resolvedDbPath = resolve(__dirname, dbPath);

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);
seedCategories(db);

// Load sample data
const samplePath = resolve(__dirname, "..", "data", "sample-db.json");
const records = JSON.parse(readFileSync(samplePath, "utf-8"));

console.log(`Restoring ${records.length} transactions from sample-db.json...`);

const insertFile = db.prepare("INSERT INTO import_files (fileName, rowCount, duplicateCount) VALUES (?, ?, 0)");
const insertTx = db.prepare(`
  INSERT OR IGNORE INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, merchantName, categoryId, isRecurring, fingerprint, confidence, categorisationMethod, isReviewed)
  VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'ai', 1)
`);

const fileResult = insertFile.run("sample-db-restore", records.length);
const fileId = Number(fileResult.lastInsertRowid);

let imported = 0;
db.transaction(() => {
  for (const r of records) {
    const fingerprint = createHash("sha256")
      .update(`${r.transactionDate}|${r.amount}|${(r.rawDescription || "").slice(0, 50)}`)
      .digest("hex");

    insertTx.run(
      fileId,
      r.transactionDate,
      r.transactionDate,
      r.amount,
      r.direction,
      r.rawDescription,
      r.merchantName,
      r.categoryId,
      r.isRecurring,
      fingerprint,
      r.confidence
    );
    imported++;
  }
})();

recalculateAll(db);
db.close();

console.log(`✓ Restored ${imported} transactions. Aggregates recalculated.`);
