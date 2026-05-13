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
    // All 3 transactions need review (isReviewed = 0)
    expect(res.body.length).toBe(3);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/transactions?month=2026-01");
    expect(res.status).toBe(401);
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

  it("returns 400 for missing matchType", async () => {
    const res = await request(app)
      .post("/api/transactions/1/create-rule")
      .set("Authorization", `Bearer ${token}`)
      .send({ matchValue: "test" });

    expect(res.status).toBe(400);
  });
});
