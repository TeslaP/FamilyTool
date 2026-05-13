import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import multer from "multer";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createImportRouter } from "../src/routes/import.js";
import { authMiddleware } from "../src/middleware/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "../../samples");

const TEST_CONFIG = {
  authUsername: "admin",
  authPassword: "testpass",
  jwtSecret: "test-secret",
};

let app: any;
let db: any;
let token: string;

beforeAll(async () => {
  delete process.env.OPENAI_API_KEY;

  const appInstance = express();
  appInstance.use(cors());
  appInstance.use(express.json());

  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const upload = multer({ storage: multer.memoryStorage() });
  appInstance.use("/api/auth", createAuthRouter(TEST_CONFIG));
  appInstance.use("/api/import", authMiddleware(TEST_CONFIG.jwtSecret), createImportRouter(db, upload, ":memory:"));

  app = appInstance;

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "testpass" });
  token = loginRes.body.token;
});

describe("Import with AI disabled", () => {
  it("imports successfully and marks uncategorised as failed", async () => {
    const previewRes = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    const confirmRes = await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "test.tab",
        transactions: previewRes.body.transactions,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.imported).toBe(3);
    expect(confirmRes.body.aiFailed).toBe(3);
    expect(confirmRes.body.aiCategorised).toBe(0);
  });

  it("transactions are marked as failed in database", async () => {
    const transactions = db.prepare(
      "SELECT categorisationMethod FROM transactions WHERE categorisationMethod = 'failed'"
    ).all();
    expect(transactions.length).toBe(3);
  });
});
