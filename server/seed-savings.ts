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
const db = new Database(resolve(__dirname, "data", "familytool.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);

const wb = XLSX.readFile(resolve(__dirname, "..", "Weekly finace planning _ Teslenko.xlsx"));
const ws = wb.Sheets["Savings"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

// Row structure:
// [0]: header row (null, Jan, Feb, mrt, apr, mei, ...)
// [1]: ["Investment Goal", 19000, 1000, 1000, ...]
// [2]: ["Investment Actual", 20000, 1181, 0, ...]
// [3]: ["Savings Goal", 0, 1000, 1000, ...]
// [4]: ["Savings Actual", 0, 1000, 1000, ...]

const investGoals = data[1];
const investActuals = data[2];
const savingsGoals = data[3];
const savingsActuals = data[4];

const insert = db.prepare(`
  INSERT OR REPLACE INTO savings_goals (year, month, investmentGoal, investmentActual, savingsGoal, savingsActual)
  VALUES (?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  for (let i = 1; i <= 12; i++) {
    insert.run(
      2025,
      i,
      investGoals[i] || 0,
      investActuals[i] || 0,
      savingsGoals[i] || 0,
      savingsActuals[i] || 0
    );
  }
})();

console.log("✓ Seeded 12 months of savings goals for 2025");
db.close();
