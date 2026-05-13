import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { runMigrations, seedCategories } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createCategoriesRouter } from "../src/routes/categories.js";
import { authMiddleware } from "../src/middleware/auth.js";

export const TEST_CONFIG = {
  authUsername: "admin",
  authPassword: "testpass",
  jwtSecret: "test-secret",
};

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedCategories(db);

  app.use("/api/auth", createAuthRouter(TEST_CONFIG));
  app.use("/api/categories", authMiddleware(TEST_CONFIG.jwtSecret), createCategoriesRouter(db));

  return { app, db };
}
