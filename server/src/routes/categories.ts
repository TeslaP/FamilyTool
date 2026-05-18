import { Router } from "express";
import type Database from "better-sqlite3";

export function createCategoriesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const categories = db.prepare(
      "SELECT id, name, parentId, type, sortOrder, isActive, isFixed FROM categories WHERE isActive = 1 ORDER BY sortOrder, name"
    ).all();
    res.json(categories);
  });

  return router;
}
