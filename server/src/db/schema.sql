CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parentId INTEGER REFERENCES categories(id),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS import_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fileName TEXT NOT NULL,
  importedAt TEXT NOT NULL DEFAULT (datetime('now')),
  rowCount INTEGER NOT NULL DEFAULT 0,
  duplicateCount INTEGER NOT NULL DEFAULT 0,
  aiRequestCount INTEGER NOT NULL DEFAULT 0,
  backupPath TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceFileId INTEGER NOT NULL REFERENCES import_files(id),
  transactionDate TEXT NOT NULL,
  valueDate TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('income', 'expense', 'transfer')),
  startBalance REAL,
  endBalance REAL,
  rawDescription TEXT NOT NULL,
  merchantName TEXT,
  categoryId INTEGER REFERENCES categories(id),
  isRecurring INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.0,
  categorisationMethod TEXT CHECK(categorisationMethod IN ('ai', 'rule', 'manual', 'failed')),
  isReviewed INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(fingerprint);

CREATE TABLE IF NOT EXISTS categorisation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchType TEXT NOT NULL CHECK(matchType IN ('exact', 'contains', 'regex')),
  matchValue TEXT NOT NULL,
  merchantName TEXT NOT NULL,
  categoryId INTEGER NOT NULL REFERENCES categories(id),
  direction TEXT NOT NULL CHECK(direction IN ('income', 'expense', 'transfer')),
  confidence REAL NOT NULL DEFAULT 1.0,
  usageCount INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  categoryId INTEGER NOT NULL REFERENCES categories(id),
  budgetAmount REAL NOT NULL,
  isFixed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(month, categoryId)
);

CREATE TABLE IF NOT EXISTS monthly_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  categoryId INTEGER NOT NULL REFERENCES categories(id),
  income REAL NOT NULL DEFAULT 0.0,
  expense REAL NOT NULL DEFAULT 0.0,
  transferOut REAL NOT NULL DEFAULT 0.0,
  recurringAmount REAL NOT NULL DEFAULT 0.0,
  transactionCount INTEGER NOT NULL DEFAULT 0,
  lastRecalculatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(month, categoryId)
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  investmentGoal REAL NOT NULL DEFAULT 0.0,
  investmentActual REAL NOT NULL DEFAULT 0.0,
  savingsGoal REAL NOT NULL DEFAULT 0.0,
  savingsActual REAL NOT NULL DEFAULT 0.0,
  UNIQUE(year, month)
);

CREATE TABLE IF NOT EXISTS ai_cache (
  descriptionHash TEXT PRIMARY KEY,
  merchantName TEXT NOT NULL,
  categoryId INTEGER NOT NULL,
  direction TEXT NOT NULL,
  isRecurring INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  intention TEXT,
  aiReflection TEXT NOT NULL,
  closingNote TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS temporal_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  reflection TEXT NOT NULL,
  inputHash TEXT,
  generatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT,
  UNIQUE(periodStart, periodEnd)
);
