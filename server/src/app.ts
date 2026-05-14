import express from "express";
import cors from "cors";
import multer from "multer";
import { getDb } from "./db/connection.js";
import { runMigrations, seedCategories } from "./db/migrate.js";
import { loadConfig } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCategoriesRouter } from "./routes/categories.js";
import { createImportRouter } from "./routes/import.js";
import { createTransactionsRouter } from "./routes/transactions.js";
import { createSummaryRouter } from "./routes/summary.js";
import { createTrajectoryRouter } from "./routes/trajectory.js";
import { authMiddleware } from "./middleware/auth.js";

export function createApp() {
  const config = loadConfig();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  const db = getDb();
  runMigrations(db);
  seedCategories(db);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(config));
  app.use("/api/categories", authMiddleware(config.jwtSecret), createCategoriesRouter(db));

  const upload = multer({ storage: multer.memoryStorage() });
  app.use("/api/import", authMiddleware(config.jwtSecret), createImportRouter(db, upload, config.dbPath));
  app.use("/api/transactions", authMiddleware(config.jwtSecret), createTransactionsRouter(db));
  app.use("/api/summary", authMiddleware(config.jwtSecret), createSummaryRouter(db));
  app.use("/api/trajectory", authMiddleware(config.jwtSecret), createTrajectoryRouter(db));

  return app;
}
