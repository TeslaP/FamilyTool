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
