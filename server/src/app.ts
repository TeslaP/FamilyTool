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
