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

function createImportTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  const upload = multer({ storage: multer.memoryStorage() });

  app.use("/api/auth", createAuthRouter(TEST_CONFIG));
  app.use("/api/import", authMiddleware(TEST_CONFIG.jwtSecret), createImportRouter(db, upload, ":memory:"));

  return { app, db };
}

let app: any;
let db: any;
let token: string;

beforeAll(async () => {
  const testApp = createImportTestApp();
  app = testApp.app;
  db = testApp.db;

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

  it("skips duplicates on second import", async () => {
    // The first import already happened in the test above (same db instance)
    const previewRes = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    const confirmRes = await request(app)
      .post("/api/import/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileName: "test-3rows-again.tab",
        transactions: previewRes.body.transactions,
      });

    expect(confirmRes.body.imported).toBe(0);
    expect(confirmRes.body.duplicatesSkipped).toBe(3);
  });

  it("detects duplicates in preview after import", async () => {
    // After the imports above, preview should show duplicates
    const res = await request(app)
      .post("/api/import/preview")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", join(samplesDir, "test-3rows.tab"));

    expect(res.body.duplicateCount).toBe(3);
    expect(res.body.newCount).toBe(0);
  });
});
