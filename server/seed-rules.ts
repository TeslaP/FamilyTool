import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), "../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import Database from "better-sqlite3";
import XLSX from "xlsx";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { runMigrations, seedCategories } from "./src/db/migrate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database("./data/familytool.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);
seedCategories(db);

// Read spreadsheet
const wb = XLSX.readFile(resolve(__dirname, "..", "Weekly finace planning _ Teslenko.xlsx"));
const ws = wb.Sheets["Data+category"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

// Extract unique description → category pairs (most common category wins)
const descCounts = new Map<string, Map<string, number>>();
data.slice(1).forEach((row) => {
  const desc = row[2] as string;
  const cat = row[3] as string;
  if (!desc || !cat || desc.length < 3) return;

  if (!descCounts.has(desc)) descCounts.set(desc, new Map());
  const catMap = descCounts.get(desc)!;
  catMap.set(cat, (catMap.get(cat) || 0) + 1);
});

// For each description, find the most common category
const merchantCategoryPairs: { merchant: string; category: string }[] = [];
for (const [merchant, catMap] of descCounts) {
  let bestCat = "";
  let bestCount = 0;
  for (const [cat, count] of catMap) {
    if (count > bestCount) { bestCat = cat; bestCount = count; }
  }
  if (bestCat) merchantCategoryPairs.push({ merchant, category: bestCat });
}

console.log(`Found ${merchantCategoryPairs.length} unique merchant→category pairs`);

// Get DB categories (leaf nodes with their type)
const dbCategories = db.prepare(`
  SELECT c.id, c.name, c.type FROM categories c WHERE c.parentId IS NOT NULL AND c.isActive = 1
`).all() as { id: number; name: string; type: string }[];

const catNameToId = new Map<string, number>();
const catNameToType = new Map<string, string>();
for (const c of dbCategories) {
  catNameToId.set(c.name.toLowerCase(), c.id);
  catNameToType.set(c.name.toLowerCase(), c.type);
}

// Check existing rules
const existingRules = new Set(
  (db.prepare("SELECT matchValue FROM categorisation_rules").all() as { matchValue: string }[])
    .map(r => r.matchValue.toLowerCase())
);

// Insert rules
const insert = db.prepare(`
  INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence)
  VALUES ('contains', ?, ?, ?, ?, 0.9)
`);

let created = 0;
let skipped = 0;
let failed = 0;

db.transaction(() => {
  for (const { merchant, category } of merchantCategoryPairs) {
    // Skip if rule already exists
    if (existingRules.has(merchant.toLowerCase())) {
      skipped++;
      continue;
    }

    // Map category name to DB ID
    const catId = catNameToId.get(category.toLowerCase());
    if (!catId) {
      failed++;
      continue;
    }

    const direction = catNameToType.get(category.toLowerCase()) || "expense";

    try {
      insert.run(merchant, merchant, catId, direction);
      created++;
    } catch {
      failed++;
    }
  }
})();

console.log(`Done! Rules created: ${created}`);
console.log(`  Skipped (already exist): ${skipped}`);
console.log(`  Failed (no category match): ${failed}`);
console.log(`  Total rules in DB: ${(db.prepare("SELECT COUNT(*) as c FROM categorisation_rules").get() as any)?.c || 0}`);

db.close();
