import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
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
    mkdirSync(backupDir);

    for (let i = 0; i < 12; i++) {
      const name = `backup-2026-01-${String(i + 1).padStart(2, "0")}-120000.sqlite`;
      writeFileSync(join(backupDir, name), "data");
    }

    cleanOldBackups(backupDir, 10);

    const remaining = readdirSync(backupDir);
    expect(remaining).toHaveLength(10);
  });

  it("does nothing if fewer than N backups exist", () => {
    const backupDir = join(tempDir, "backups");
    mkdirSync(backupDir);

    for (let i = 0; i < 3; i++) {
      writeFileSync(join(backupDir, `backup-2026-01-0${i + 1}-120000.sqlite`), "data");
    }

    cleanOldBackups(backupDir, 10);

    const remaining = readdirSync(backupDir);
    expect(remaining).toHaveLength(3);
  });
});
