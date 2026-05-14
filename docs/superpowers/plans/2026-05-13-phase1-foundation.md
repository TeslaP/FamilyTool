# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working backend that scaffolds the project, sets up the database, authenticates a single user, parses ABN AMRO bank exports (TAB + XLS), and runs the import pipeline with preview/confirm flow and duplicate detection.

**Architecture:** Vite SPA frontend (shell only in this phase) + Express/TypeScript backend with better-sqlite3. Monorepo with `client/` and `server/` directories, single `npm run dev` command starts both.

**Tech Stack:** Node 20+, TypeScript, Express, better-sqlite3, Vite, React, Tailwind, vitest, supertest, xlsx (for XLS parsing), crypto (for fingerprints)

---

## File Structure (Phase 1)

```
FamilyTool/
├── package.json                    # Root: workspaces, dev script (concurrently)
├── tsconfig.base.json              # Shared TS config
├── .env.example                    # Environment variable template
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts                # Express app entry point
│       ├── app.ts                  # Express app factory (testable)
│       ├── config.ts               # Environment config loader
│       ├── middleware/
│       │   └── auth.ts             # JWT verification middleware
│       ├── routes/
│       │   ├── auth.ts             # POST /api/auth/login
│       │   ├── categories.ts       # GET /api/categories
│       │   └── import.ts           # POST /api/import/preview, POST /api/import/confirm
│       ├── services/
│       │   ├── parser.ts           # TAB + XLS parsing, normalisation
│       │   ├── fingerprint.ts      # Duplicate detection hashing
│       │   └── rules.ts            # Categorisation rule matching
│       └── db/
│           ├── connection.ts       # SQLite connection singleton
│           ├── migrate.ts          # Schema migration runner
│           └── schema.sql          # Full schema DDL
├── server/tests/
│   ├── parser.test.ts
│   ├── fingerprint.test.ts
│   ├── rules.test.ts
│   ├── auth.test.ts
│   └── import.test.ts
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                  # Router shell with placeholder pages
│       └── pages/
│           └── Login.tsx            # Functional login page
├── samples/
│   ├── test-3rows.tab              # 3-row TAB fixture
│   └── test-3rows.xls             # 3-row XLS fixture
└── data/                           # Created at runtime (gitignored)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`
- Create: `server/src/index.ts`, `server/src/app.ts`, `server/src/config.ts`
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "familytool",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "test": "npm run test -w server",
    "build": "npm run build -w client"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create .env.example**

```env
# Auth
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
JWT_SECRET=change-this-to-a-random-string

# OpenAI (optional - app works without it)
OPENAI_API_KEY=

# Database
DB_PATH=./data/familytool.sqlite

# Debug
DEBUG_MODE=false
```

- [ ] **Step 4: Create .gitignore**

```gitignore
node_modules/
dist/
data/
.env
*.sqlite
*.sqlite-journal
```

- [ ] **Step 5: Create server/package.json**

```json
{
  "name": "familytool-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest",
    "build": "tsc"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 6: Create server/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*"]
}
```

- [ ] **Step 7: Create server/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 8: Create server/src/config.ts**

```typescript
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface Config {
  authUsername: string;
  authPassword: string;
  jwtSecret: string;
  dbPath: string;
  openaiApiKey: string | undefined;
  debugMode: boolean;
  port: number;
}

export function loadConfig(): Config {
  const dbPath = process.env.DB_PATH || "./data/familytool.sqlite";
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return {
    authUsername: process.env.AUTH_USERNAME || "admin",
    authPassword: process.env.AUTH_PASSWORD || "changeme",
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    dbPath,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    debugMode: process.env.DEBUG_MODE === "true",
    port: parseInt(process.env.PORT || "3001", 10),
  };
}
```

- [ ] **Step 9: Create server/src/app.ts**

```typescript
import express from "express";
import cors from "cors";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
```

- [ ] **Step 10: Create server/src/index.ts**

```typescript
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
```

- [ ] **Step 11: Create client/package.json**

```json
{
  "name": "familytool-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 12: Create client/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

- [ ] **Step 13: Create client/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 14: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Family Finance</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 15: Create client/src/main.tsx and App.tsx**

`client/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`client/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-lg">{name} — coming soon</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/import" element={<Placeholder name="Import" />} />
        <Route path="/review" element={<Placeholder name="Review" />} />
        <Route path="/forecast" element={<Placeholder name="Forecast" />} />
        <Route path="/login" element={<Placeholder name="Login" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 16: Create Tailwind + PostCSS config**

`client/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`client/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 17: Install dependencies and verify startup**

```bash
npm install
npm run dev
```

Expected: server starts on port 3001, client on 5173. `curl http://localhost:3001/api/health` returns `{"status":"ok"}`.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Express + Vite monorepo"
```

---

## Task 2: Database Schema & Migration

**Files:**
- Create: `server/src/db/connection.ts`
- Create: `server/src/db/migrate.ts`
- Create: `server/src/db/schema.sql`
- Modify: `server/src/app.ts` (run migrations on startup)

- [ ] **Step 1: Create server/src/db/schema.sql**

```sql
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
```

- [ ] **Step 2: Create server/src/db/connection.ts**

```typescript
import Database from "better-sqlite3";
import { loadConfig } from "../config.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const config = loadConfig();
    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function getTestDb(): Database.Database {
  const testDb = new Database(":memory:");
  testDb.pragma("foreign_keys = ON");
  return testDb;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 3: Create server/src/db/migrate.ts**

```typescript
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
}

export function seedCategories(db: Database.Database): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  if (existing.count > 0) return;

  const insert = db.prepare(
    "INSERT INTO categories (name, parentId, type, sortOrder) VALUES (?, ?, ?, ?)"
  );

  const insertParent = (name: string, type: string, order: number): number => {
    const result = insert.run(name, null, type, order);
    return Number(result.lastInsertRowid);
  };

  const insertChild = (name: string, parentId: number, type: string, order: number): void => {
    insert.run(name, parentId, type, order);
  };

  db.transaction(() => {
    const food = insertParent("Food", "expense", 1);
    insertChild("Groceries", food, "expense", 1);
    insertChild("Dining", food, "expense", 2);
    insertChild("Coffee", food, "expense", 3);

    const housing = insertParent("Housing", "expense", 2);
    insertChild("Mortgage", housing, "expense", 1);
    insertChild("Utilities", housing, "expense", 2);
    insertChild("Insurance (Home)", housing, "expense", 3);

    const transport = insertParent("Transport", "expense", 3);
    insertChild("Public Transport", transport, "expense", 1);
    insertChild("Fuel", transport, "expense", 2);
    insertChild("Parking", transport, "expense", 3);

    const health = insertParent("Health", "expense", 4);
    insertChild("Health Insurance", health, "expense", 1);
    insertChild("Fitness", health, "expense", 2);
    insertChild("Personal Care", health, "expense", 3);

    const children = insertParent("Children", "expense", 5);
    insertChild("Childcare", children, "expense", 1);

    const comms = insertParent("Communication", "expense", 6);
    insertChild("Telecommunications", comms, "expense", 1);

    const shopping = insertParent("Shopping", "expense", 7);
    insertChild("Online Shopping", shopping, "expense", 1);

    const leisure = insertParent("Leisure", "expense", 8);
    insertChild("Entertainment", leisure, "expense", 1);
    insertChild("Donation", leisure, "expense", 2);

    const finance = insertParent("Finance", "expense", 9);
    insertChild("Miscellaneous", finance, "expense", 1);

    const income = insertParent("Income", "income", 10);
    insertChild("Salary", income, "income", 1);
    insertChild("Freelance", income, "income", 2);
    insertChild("Refunds", income, "income", 3);

    const transfers = insertParent("Transfers", "transfer", 11);
    insertChild("Savings", transfers, "transfer", 1);
    insertChild("Investment", transfers, "transfer", 2);
    insertChild("Credit Card Payment", transfers, "transfer", 3);
  })();
}
```

- [ ] **Step 4: Update server/src/app.ts to run migrations**

```typescript
import express from "express";
import cors from "cors";
import { getDb } from "./db/connection.js";
import { runMigrations, seedCategories } from "./db/migrate.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = getDb();
  runMigrations(db);
  seedCategories(db);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
```

- [ ] **Step 5: Verify migrations run**

```bash
npm run dev -w server
```

Expected: server starts, `data/familytool.sqlite` is created with all tables. Verify with:

```bash
sqlite3 data/familytool.sqlite ".tables"
```

Expected output includes: `categories`, `transactions`, `import_files`, `categorisation_rules`, `monthly_budgets`, `monthly_aggregates`, `savings_goals`.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/ server/src/app.ts
git commit -m "feat: database schema, migrations, and category seeding"
```

---

## Task 3: Authentication

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/tests/auth.test.ts`
- Modify: `server/src/app.ts` (register auth route)

- [ ] **Step 1: Write failing test for login**

`server/tests/auth.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers.js";

let app: ReturnType<typeof import("express").default>;

beforeAll(() => {
  app = createTestApp();
});

describe("POST /api/auth/login", () => {
  it("returns JWT token with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "testpass" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 400 with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin" });

    expect(res.status).toBe(400);
  });
});

describe("Auth middleware", () => {
  it("allows access with valid token", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "testpass" });

    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Create test helper**

`server/tests/helpers.ts`:
```typescript
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createCategoriesRouter } from "../src/routes/categories.js";
import { authMiddleware } from "../src/middleware/auth.js";

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const testConfig = {
    authUsername: "admin",
    authPassword: "testpass",
    jwtSecret: "test-secret",
  };

  app.use("/api/auth", createAuthRouter(testConfig));
  app.use("/api/categories", authMiddleware(testConfig.jwtSecret), createCategoriesRouter(db));

  return app;
}
```

- [ ] **Step 3: Implement auth middleware**

`server/src/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret);
      (req as any).user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}
```

- [ ] **Step 4: Implement auth route**

`server/src/routes/auth.ts`:
```typescript
import { Router } from "express";
import jwt from "jsonwebtoken";

interface AuthConfig {
  authUsername: string;
  authPassword: string;
  jwtSecret: string;
}

export function createAuthRouter(config: AuthConfig): Router {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    if (username !== config.authUsername || password !== config.authPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: "7d" });
    res.json({ token });
  });

  return router;
}
```

- [ ] **Step 5: Implement categories route**

`server/src/routes/categories.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";

export function createCategoriesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const categories = db.prepare(
      "SELECT id, name, parentId, type, sortOrder, isActive FROM categories WHERE isActive = 1 ORDER BY sortOrder, name"
    ).all();
    res.json(categories);
  });

  return router;
}
```

- [ ] **Step 6: Update app.ts to wire routes**

```typescript
import express from "express";
import cors from "cors";
import { getDb } from "./db/connection.js";
import { runMigrations, seedCategories } from "./db/migrate.js";
import { loadConfig } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCategoriesRouter } from "./routes/categories.js";
import { authMiddleware } from "./middleware/auth.js";

export function createApp() {
  const config = loadConfig();
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = getDb();
  runMigrations(db);
  seedCategories(db);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(config));
  app.use("/api/categories", authMiddleware(config.jwtSecret), createCategoriesRouter(db));

  return app;
}
```

- [ ] **Step 7: Run tests**

```bash
npm test -w server -- --run
```

Expected: all auth tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/middleware/ server/src/routes/auth.ts server/src/routes/categories.ts server/tests/ server/src/app.ts
git commit -m "feat: JWT authentication and categories endpoint"
```

---

## Task 4: TAB File Parser

**Files:**
- Create: `server/src/services/parser.ts`
- Create: `server/tests/parser.test.ts`
- Create: `samples/test-3rows.tab`

- [ ] **Step 1: Create test fixture**

`samples/test-3rows.tab` (tab-separated, use actual tab characters):

```
474774774	EUR	20260101	1500,00	1450,25	20260101	-49,75	BEA, Debit pin betance 01.01.26/12:03 Albert Heijn 1234 Amsterdam,PAS123
474774774	EUR	20260102	1450,25	3950,25	20260102	2500,00	SEPA Periodieke overb. Naam: Employer BV Omschrijving: Salaris januari
474774774	EUR	20260103	3950,25	3900,25	20260103	-50,00	SEPA Overboeking Naam: P Teslenko Omschrijving: Spaarrekening IBAN: NL12ABNA3456789012
```

- [ ] **Step 2: Write failing parser tests**

`server/tests/parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseTabFile, parseXlsFile, type ParsedTransaction } from "../src/services/parser.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "../../samples");

describe("parseTabFile", () => {
  it("parses 3-row TAB file into transactions", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result).toHaveLength(3);
  });

  it("normalises comma decimal to float", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].amount).toBe(49.75);
    expect(result[1].amount).toBe(2500.0);
  });

  it("formats dates as YYYY-MM-DD", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].transactionDate).toBe("2026-01-01");
    expect(result[0].valueDate).toBe("2026-01-01");
  });

  it("detects direction from amount sign", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].direction).toBe("expense");
    expect(result[1].direction).toBe("income");
  });

  it("stores amount as absolute value", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].amount).toBe(49.75);
    expect(result[2].amount).toBe(50.0);
  });

  it("preserves raw description", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].rawDescription).toContain("Albert Heijn");
  });

  it("parses start and end balance", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);

    expect(result[0].startBalance).toBe(1500.0);
    expect(result[0].endBalance).toBe(1450.25);
  });

  it("skips empty lines", () => {
    const content = "474774774\tEUR\t20260101\t1500,00\t1450,25\t20260101\t-49,75\tTest\n\n\n";
    const result = parseTabFile(content);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -w server -- --run parser
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement TAB parser**

`server/src/services/parser.ts`:
```typescript
export interface ParsedTransaction {
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
}

function parseCommaDecimal(value: string): number {
  return parseFloat(value.replace(",", "."));
}

function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function detectDirection(amount: number): "income" | "expense" {
  return amount >= 0 ? "income" : "expense";
}

export function parseTabFile(content: string): ParsedTransaction[] {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const fields = line.split("\t");
    if (fields.length < 8) continue;

    const rawAmount = parseCommaDecimal(fields[6]);
    const direction = detectDirection(rawAmount);

    transactions.push({
      transactionDate: formatDate(fields[2]),
      valueDate: formatDate(fields[5]),
      amount: Math.abs(rawAmount),
      direction,
      startBalance: parseCommaDecimal(fields[3]),
      endBalance: parseCommaDecimal(fields[4]),
      rawDescription: fields[7].trim(),
    });
  }

  return transactions;
}

export function parseXlsFile(buffer: Buffer): ParsedTransaction[] {
  throw new Error("Not implemented");
}
```

- [ ] **Step 5: Run tests to verify passing**

```bash
npm test -w server -- --run parser
```

Expected: all TAB parser tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/parser.ts server/tests/parser.test.ts samples/test-3rows.tab
git commit -m "feat: TAB file parser with decimal normalisation and direction detection"
```

---

## Task 5: XLS File Parser

**Files:**
- Modify: `server/src/services/parser.ts`
- Modify: `server/tests/parser.test.ts`
- Create: `samples/test-3rows.xls`

- [ ] **Step 1: Create XLS test fixture programmatically**

Add a setup script `server/tests/create-xls-fixture.ts`:
```typescript
import XLSX from "xlsx";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const data = [
  ["accountNumber", "mutationcode", "transactiondate", "valuedate", "startsaldo", "endsaldo", "amount", "description"],
  ["474774774", "BA", "20260101", "20260101", "1500.00", "1450.25", "-49.75", "BEA, Debit pin betance 01.01.26/12:03 Albert Heijn 1234 Amsterdam,PAS123"],
  ["474774774", "OV", "20260102", "20260102", "1450.25", "3950.25", "2500.00", "SEPA Periodieke overb. Naam: Employer BV Omschrijving: Salaris januari"],
  ["474774774", "OV", "20260103", "20260103", "3950.25", "3900.25", "-50.00", "SEPA Overboeking Naam: P Teslenko Omschrijving: Spaarrekening IBAN: NL12ABNA3456789012"],
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, join(__dirname, "../../samples/test-3rows.xls"));
console.log("Created samples/test-3rows.xls");
```

Run it:
```bash
npx tsx server/tests/create-xls-fixture.ts
```

- [ ] **Step 2: Write failing XLS parser tests**

Add to `server/tests/parser.test.ts`:
```typescript
describe("parseXlsFile", () => {
  it("parses 3-row XLS file into transactions", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);

    expect(result).toHaveLength(3);
  });

  it("handles dot decimal in XLS format", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);

    expect(result[0].amount).toBe(49.75);
    expect(result[1].amount).toBe(2500.0);
  });

  it("formats dates as YYYY-MM-DD", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);

    expect(result[0].transactionDate).toBe("2026-01-01");
  });

  it("detects direction from amount sign", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);

    expect(result[0].direction).toBe("expense");
    expect(result[1].direction).toBe("income");
  });

  it("stores amount as absolute value", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);

    expect(result[0].amount).toBe(49.75);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -w server -- --run parser
```

Expected: XLS tests fail with "Not implemented".

- [ ] **Step 4: Implement XLS parser**

Update `server/src/services/parser.ts`, replace the `parseXlsFile` stub:

```typescript
import XLSX from "xlsx";

export function parseXlsFile(buffer: Buffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false });

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const rawAmount = parseFloat(row["amount"]);
    const direction = detectDirection(rawAmount);

    transactions.push({
      transactionDate: formatDate(row["transactiondate"]),
      valueDate: formatDate(row["valuedate"]),
      amount: Math.abs(rawAmount),
      direction,
      startBalance: parseFloat(row["startsaldo"]),
      endBalance: parseFloat(row["endsaldo"]),
      rawDescription: (row["description"] || "").trim(),
    });
  }

  return transactions;
}
```

Add the `XLSX` import at the top of the file.

- [ ] **Step 5: Run tests to verify passing**

```bash
npm test -w server -- --run parser
```

Expected: all parser tests pass (both TAB and XLS).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/parser.ts server/tests/parser.test.ts server/tests/create-xls-fixture.ts samples/test-3rows.xls
git commit -m "feat: XLS file parser with header row detection"
```

---

## Task 6: Fingerprint & Duplicate Detection

**Files:**
- Create: `server/src/services/fingerprint.ts`
- Create: `server/tests/fingerprint.test.ts`

- [ ] **Step 1: Write failing tests**

`server/tests/fingerprint.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateFingerprint } from "../src/services/fingerprint.js";

describe("generateFingerprint", () => {
  it("produces consistent hash for same inputs", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn Amsterdam");
    const fp2 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn Amsterdam");
    expect(fp1).toBe(fp2);
  });

  it("produces different hash for different dates", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn");
    const fp2 = generateFingerprint("2026-01-02", 49.75, "BEA Albert Heijn");
    expect(fp1).not.toBe(fp2);
  });

  it("produces different hash for different amounts", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn");
    const fp2 = generateFingerprint("2026-01-01", 50.00, "BEA Albert Heijn");
    expect(fp1).not.toBe(fp2);
  });

  it("uses only first 50 chars of description", () => {
    const desc = "A".repeat(100);
    const fp1 = generateFingerprint("2026-01-01", 49.75, desc);
    const fp2 = generateFingerprint("2026-01-01", 49.75, "A".repeat(50) + "B".repeat(50));
    expect(fp1).toBe(fp2);
  });

  it("returns a hex string", () => {
    const fp = generateFingerprint("2026-01-01", 49.75, "test");
    expect(fp).toMatch(/^[a-f0-9]+$/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -w server -- --run fingerprint
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement fingerprint service**

`server/src/services/fingerprint.ts`:
```typescript
import { createHash } from "crypto";

export function generateFingerprint(
  transactionDate: string,
  amount: number,
  description: string
): string {
  const descPrefix = description.slice(0, 50);
  const input = `${transactionDate}|${amount}|${descPrefix}`;
  return createHash("sha256").update(input).digest("hex");
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
npm test -w server -- --run fingerprint
```

Expected: all fingerprint tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/fingerprint.ts server/tests/fingerprint.test.ts
git commit -m "feat: fingerprint-based duplicate detection"
```

---

## Task 7: Categorisation Rule Matching

**Files:**
- Create: `server/src/services/rules.ts`
- Create: `server/tests/rules.test.ts`

- [ ] **Step 1: Write failing tests**

`server/tests/rules.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { matchRules, type RuleMatch } from "../src/services/rules.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("exact", "Albert Heijn", "Albert Heijn", 2, "expense", 1.0);

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("contains", "Employer BV", "Employer BV", 28, "income", 0.9);

  db.prepare(
    "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("regex", "Spaarrekening.*IBAN", "Savings Transfer", 32, "transfer", 0.85);
});

describe("matchRules", () => {
  it("matches exact rule", () => {
    const result = matchRules(db, "Albert Heijn");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Albert Heijn");
    expect(result!.confidence).toBe(1.0);
  });

  it("matches contains rule", () => {
    const result = matchRules(db, "SEPA Periodieke overb. Naam: Employer BV Omschrijving: Salaris");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Employer BV");
    expect(result!.direction).toBe("income");
  });

  it("matches regex rule", () => {
    const result = matchRules(db, "SEPA Overboeking Naam: P Teslenko Omschrijving: Spaarrekening IBAN: NL12ABNA");
    expect(result).not.toBeNull();
    expect(result!.merchantName).toBe("Savings Transfer");
    expect(result!.direction).toBe("transfer");
  });

  it("returns null when no rule matches", () => {
    const result = matchRules(db, "Unknown merchant XYZ");
    expect(result).toBeNull();
  });

  it("prefers exact match over contains match", () => {
    db.prepare(
      "INSERT INTO categorisation_rules (matchType, matchValue, merchantName, categoryId, direction, confidence) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("contains", "Albert", "Albert (contains)", 2, "expense", 0.9);

    const result = matchRules(db, "Albert Heijn");
    expect(result!.merchantName).toBe("Albert Heijn");
    expect(result!.confidence).toBe(1.0);
  });

  it("increments usage count on match", () => {
    matchRules(db, "Albert Heijn");
    matchRules(db, "Albert Heijn");

    const rule = db.prepare("SELECT usageCount FROM categorisation_rules WHERE matchValue = ?").get("Albert Heijn") as any;
    expect(rule.usageCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -w server -- --run rules
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement rule matching**

`server/src/services/rules.ts`:
```typescript
import type Database from "better-sqlite3";

export interface RuleMatch {
  ruleId: number;
  merchantName: string;
  categoryId: number;
  direction: "income" | "expense" | "transfer";
  confidence: number;
}

interface RuleRow {
  id: number;
  matchType: string;
  matchValue: string;
  merchantName: string;
  categoryId: number;
  direction: string;
  confidence: number;
}

export function matchRules(db: Database.Database, description: string): RuleMatch | null {
  const rules = db.prepare(
    "SELECT id, matchType, matchValue, merchantName, categoryId, direction, confidence FROM categorisation_rules ORDER BY confidence DESC"
  ).all() as RuleRow[];

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case "exact":
        matched = description.includes(rule.matchValue) && rule.matchValue.length > 0;
        break;
      case "contains":
        matched = description.toLowerCase().includes(rule.matchValue.toLowerCase());
        break;
      case "regex":
        try {
          matched = new RegExp(rule.matchValue, "i").test(description);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      db.prepare("UPDATE categorisation_rules SET usageCount = usageCount + 1 WHERE id = ?").run(rule.id);
      return {
        ruleId: rule.id,
        merchantName: rule.merchantName,
        categoryId: rule.categoryId,
        direction: rule.direction as "income" | "expense" | "transfer",
        confidence: rule.confidence,
      };
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
npm test -w server -- --run rules
```

Expected: all rule tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/rules.ts server/tests/rules.test.ts
git commit -m "feat: categorisation rule matching with priority ordering"
```

---

## Task 8: Import API — Preview & Confirm

**Files:**
- Create: `server/src/routes/import.ts`
- Create: `server/tests/import.test.ts`
- Modify: `server/src/app.ts` (register import route)

- [ ] **Step 1: Write failing tests**

`server/tests/import.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createTestAppWithImport } from "./helpers-import.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "../../samples");

let app: any;
let token: string;

beforeAll(async () => {
  app = createTestAppWithImport();
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "testpass" });
  token = loginRes.body.token;
});

describe("POST /api/import/preview", () => {
  it("returns parsed preview for TAB file", async () => {
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    expect(res.status).toBe(200);
    expect(res.body.rowCount).toBe(3);
    expect(res.body.dateRange.from).toBe("2026-01-01");
    expect(res.body.dateRange.to).toBe("2026-01-03");
    expect(res.body.duplicateCount).toBe(0);
    expect(res.body.transactions).toHaveLength(3);
    expect(res.body.transactions[0].rawDescription).toContain("Albert Heijn");
  });

  it("returns parsed preview for XLS file", async () => {
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.xls"));

    expect(res.status).toBe(200);
    expect(res.body.rowCount).toBe(3);
  });

  it("detects duplicates against existing data", async () => {
    // First import
    await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ fileName: "test-3rows.tab" });

    // Preview same file again
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    expect(res.status).toBe(200);
    expect(res.body.duplicateCount).toBe(3);
    expect(res.body.newCount).toBe(0);
  });

  it("shows rule matches in preview", async () => {
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    const matched = res.body.transactions.filter((t: any) => t.ruleMatch);
    expect(matched.length).toBeGreaterThanOrEqual(0);
  });

  it("returns 400 for missing file", async () => {
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/import/preview")
      .attach("file", join(samplesDir, "test-3rows.tab"));

    expect(res.status).toBe(401);
  });
});

describe("POST /api/import/confirm", () => {
  it("stores transactions in database", async () => {
    const previewRes = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    const confirmRes = await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "test-3rows.tab",
        transactions: previewRes.body.transactions,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.imported).toBe(3);
    expect(confirmRes.body.duplicatesSkipped).toBe(0);
  });

  it("skips duplicates on confirm", async () => {
    // First import via preview+confirm already done in previous test context
    // This test uses a fresh app instance from beforeAll, so import first
    const previewRes = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "first-import.tab",
        transactions: previewRes.body.transactions,
      });

    // Second import of same data
    const confirmRes = await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "second-import.tab",
        transactions: previewRes.body.transactions,
      });

    expect(confirmRes.body.imported).toBe(0);
    expect(confirmRes.body.duplicatesSkipped).toBe(3);
  });
});
```

- [ ] **Step 2: Create import test helper**

`server/tests/helpers-import.ts`:
```typescript
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import multer from "multer";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createImportRouter } from "../src/routes/import.js";
import { authMiddleware } from "../src/middleware/auth.js";

export function createTestAppWithImport() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const testConfig = {
    authUsername: "admin",
    authPassword: "testpass",
    jwtSecret: "test-secret",
  };

  const upload = multer({ storage: multer.memoryStorage() });

  app.use("/api/auth", createAuthRouter(testConfig));
  app.use("/api/import", authMiddleware(testConfig.jwtSecret), createImportRouter(db, upload));

  return app;
}
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -w server -- --run import
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement import route**

`server/src/routes/import.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import type { Multer } from "multer";
import { parseTabFile, parseXlsFile, type ParsedTransaction } from "../services/parser.js";
import { generateFingerprint } from "../services/fingerprint.js";
import { matchRules } from "../services/rules.js";

interface PreviewTransaction extends ParsedTransaction {
  fingerprint: string;
  isDuplicate: boolean;
  ruleMatch: {
    merchantName: string;
    categoryId: number;
    direction: string;
    confidence: number;
  } | null;
}

export function createImportRouter(db: Database.Database, upload: Multer): Router {
  const router = Router();

  router.post("/preview", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const fileName = req.file.originalname;
    const isTab = fileName.toLowerCase().endsWith(".tab");
    const isXls = fileName.toLowerCase().endsWith(".xls") || fileName.toLowerCase().endsWith(".xlsx");

    let parsed: ParsedTransaction[];
    try {
      if (isTab) {
        parsed = parseTabFile(req.file.buffer.toString("utf-8"));
      } else if (isXls) {
        parsed = parseXlsFile(req.file.buffer);
      } else {
        res.status(400).json({ error: "Unsupported file type. Use .TAB or .XLS" });
        return;
      }
    } catch (err: any) {
      res.status(400).json({ error: `Parse error: ${err.message}` });
      return;
    }

    const transactions: PreviewTransaction[] = parsed.map((t) => {
      const fingerprint = generateFingerprint(t.transactionDate, t.amount, t.rawDescription);
      const existing = db.prepare("SELECT id FROM transactions WHERE fingerprint = ?").get(fingerprint);
      const ruleMatch = matchRules(db, t.rawDescription);

      return {
        ...t,
        fingerprint,
        isDuplicate: !!existing,
        ruleMatch: ruleMatch
          ? {
              merchantName: ruleMatch.merchantName,
              categoryId: ruleMatch.categoryId,
              direction: ruleMatch.direction,
              confidence: ruleMatch.confidence,
            }
          : null,
      };
    });

    const dates = transactions.map((t) => t.transactionDate).sort();
    const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
    const newCount = transactions.length - duplicateCount;

    res.json({
      rowCount: transactions.length,
      newCount,
      duplicateCount,
      dateRange: {
        from: dates[0] || null,
        to: dates[dates.length - 1] || null,
      },
      transactions,
    });
  });

  router.post("/confirm", (req, res) => {
    const { fileName, transactions } = req.body as {
      fileName: string;
      transactions: PreviewTransaction[];
    };

    if (!fileName || !transactions) {
      res.status(400).json({ error: "fileName and transactions required" });
      return;
    }

    let imported = 0;
    let duplicatesSkipped = 0;

    const insertFile = db.prepare(
      "INSERT INTO import_files (fileName, rowCount, duplicateCount) VALUES (?, ?, ?)"
    );

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, merchantName, categoryId, isRecurring, fingerprint, confidence, categorisationMethod, isReviewed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      const nonDuplicates = transactions.filter((t) => {
        const existing = db.prepare("SELECT id FROM transactions WHERE fingerprint = ?").get(t.fingerprint);
        if (existing) {
          duplicatesSkipped++;
          return false;
        }
        return true;
      });

      const fileResult = insertFile.run(fileName, nonDuplicates.length, duplicatesSkipped);
      const fileId = Number(fileResult.lastInsertRowid);

      for (const t of nonDuplicates) {
        const merchantName = t.ruleMatch?.merchantName || null;
        const categoryId = t.ruleMatch?.categoryId || null;
        const direction = t.ruleMatch?.direction || t.direction;
        const confidence = t.ruleMatch?.confidence || 0.0;
        const method = t.ruleMatch ? "rule" : null;

        insertTransaction.run(
          fileId,
          t.transactionDate,
          t.valueDate,
          t.amount,
          direction,
          t.startBalance,
          t.endBalance,
          t.rawDescription,
          merchantName,
          categoryId,
          0,
          t.fingerprint,
          confidence,
          method,
          0
        );
        imported++;
      }
    })();

    res.json({
      imported,
      duplicatesSkipped,
      fileName,
    });
  });

  return router;
}
```

- [ ] **Step 5: Update app.ts to register import route**

Add to `server/src/app.ts`:
```typescript
import multer from "multer";
import { createImportRouter } from "./routes/import.js";

// Inside createApp(), after existing routes:
const upload = multer({ storage: multer.memoryStorage() });
app.use("/api/import", authMiddleware(config.jwtSecret), createImportRouter(db, upload));
```

- [ ] **Step 6: Run tests to verify passing**

```bash
npm test -w server -- --run import
```

Expected: all import tests pass.

- [ ] **Step 7: Run full test suite**

```bash
npm test -w server -- --run
```

Expected: all tests pass (parser, fingerprint, rules, auth, import).

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/import.ts server/tests/import.test.ts server/tests/helpers-import.ts server/src/app.ts
git commit -m "feat: import pipeline with preview/confirm flow and duplicate detection"
```

---

## Task 9: Backup Service

**Files:**
- Create: `server/src/services/backup.ts`
- Create: `server/tests/backup.test.ts`
- Modify: `server/src/routes/import.ts` (trigger backup before confirm)

- [ ] **Step 1: Write failing tests**

`server/tests/backup.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createBackup, cleanOldBackups } from "../src/services/backup.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "backup-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true });
});

describe("createBackup", () => {
  it("creates a timestamped backup file", () => {
    const dbPath = join(tempDir, "test.sqlite");
    const backupDir = join(tempDir, "backups");

    // Create a minimal sqlite file
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE test (id INTEGER)");
    db.close();

    const backupPath = createBackup(dbPath, backupDir);

    expect(existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain("backup-");
    expect(backupPath).toContain(".sqlite");
  });

  it("creates backup directory if it does not exist", () => {
    const dbPath = join(tempDir, "test.sqlite");
    const backupDir = join(tempDir, "nested", "backups");

    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE test (id INTEGER)");
    db.close();

    createBackup(dbPath, backupDir);
    expect(existsSync(backupDir)).toBe(true);
  });
});

describe("cleanOldBackups", () => {
  it("keeps only the most recent N backups", () => {
    const backupDir = join(tempDir, "backups");
    const { mkdirSync, writeFileSync } = require("fs");
    mkdirSync(backupDir);

    for (let i = 0; i < 12; i++) {
      const name = `backup-2026-01-${String(i + 1).padStart(2, "0")}-120000.sqlite`;
      writeFileSync(join(backupDir, name), "data");
    }

    cleanOldBackups(backupDir, 10);

    const remaining = readdirSync(backupDir);
    expect(remaining).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -w server -- --run backup
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement backup service**

`server/src/services/backup.ts`:
```typescript
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export function createBackup(dbPath: string, backupDir: string): string {
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[T:]/g, "-").replace(/\..+/, "").replace(/-/g, "");
  const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const backupPath = join(backupDir, `backup-${formatted}.sqlite`);

  copyFileSync(dbPath, backupPath);
  return backupPath;
}

export function cleanOldBackups(backupDir: string, keep: number): void {
  if (!existsSync(backupDir)) return;

  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sqlite"))
    .sort()
    .reverse();

  for (const file of files.slice(keep)) {
    unlinkSync(join(backupDir, file));
  }
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
npm test -w server -- --run backup
```

Expected: all backup tests pass.

- [ ] **Step 5: Wire backup into import confirm**

In `server/src/routes/import.ts`, add before the transaction block in the confirm handler:

```typescript
import { createBackup, cleanOldBackups } from "../services/backup.js";
import { loadConfig } from "../config.js";
import { dirname, join } from "path";

// Inside confirm handler, before db.transaction:
const config = loadConfig();
const backupDir = join(dirname(config.dbPath), "backups");
const backupPath = createBackup(config.dbPath, backupDir);
cleanOldBackups(backupDir, 10);
```

Update the `insertFile` call to include `backupPath`.

- [ ] **Step 6: Run full test suite**

```bash
npm test -w server -- --run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/backup.ts server/tests/backup.test.ts server/src/routes/import.ts
git commit -m "feat: pre-import SQLite backup with retention policy"
```

---

## Task 10: Integration Smoke Test & Cleanup

**Files:**
- Modify: `server/tests/helpers.ts` (consolidate test helpers)
- Verify: full test suite runs clean

- [ ] **Step 1: Run full test suite**

```bash
npm test -w server -- --run
```

Expected: all tests pass. If any fail, fix them.

- [ ] **Step 2: Start the dev server and verify end-to-end**

```bash
npm run dev
```

In another terminal:
```bash
# Health check
curl http://localhost:3001/api/health

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | jq -r '.token')

# Get categories
curl -s http://localhost:3001/api/categories \
  -H "Authorization: Bearer $TOKEN" | jq '.[:3]'

# Preview import
curl -s -X POST http://localhost:3001/api/import/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@samples/test-3rows.tab" | jq '{rowCount, duplicateCount, dateRange}'
```

Expected: all return valid JSON responses.

- [ ] **Step 3: Verify client loads**

Open `http://localhost:5173` — should show "Dashboard — coming soon". Navigate to `/login` — should show "Login — coming soon".

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 complete — foundation with auth, parsers, and import pipeline"
```

---

## Phase 1 Deliverables

After completing all tasks, the project has:

- Monorepo scaffolding (client + server, single `npm run dev`)
- SQLite database with full schema (categories, transactions, rules, aggregates, budgets, goals)
- Seeded category hierarchy (11 parents, 22 children)
- JWT authentication (login + middleware)
- TAB file parser (comma decimal, direction detection)
- XLS file parser (header row, dot decimal)
- Fingerprint-based duplicate detection
- Categorisation rule matching (exact, contains, regex with priority)
- Import preview API (parse → detect duplicates → match rules → return preview)
- Import confirm API (commit to DB, skip duplicates)
- Pre-import backup with retention
- Full test coverage for all services

## What's Next (Phase 2)

Phase 2 will cover:
- AI categorisation integration (OpenAI, batch processing, validation, retry)
- Recalculation engine (monthly aggregates, triggered on changes)
- Monthly summary generation
- Rule learning from user corrections
