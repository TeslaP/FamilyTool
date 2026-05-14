import { Router } from "express";
import type Database from "better-sqlite3";
import type { Multer } from "multer";
import { dirname, join } from "path";
import { spawn } from "child_process";
import { parseTabFile, parseXlsFile, type ParsedTransaction } from "../services/parser.js";
import { generateFingerprint } from "../services/fingerprint.js";
import { matchRules } from "../services/rules.js";
import { createBackup, cleanOldBackups } from "../services/backup.js";
import { recalculateAffectedMonths } from "../services/recalculation.js";

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

export function createImportRouter(db: Database.Database, upload: Multer, dbPath: string): Router {
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

  router.post("/confirm", async (req, res) => {
    const { fileName, transactions } = req.body as {
      fileName: string;
      transactions: PreviewTransaction[];
    };

    if (!fileName || !transactions) {
      res.status(400).json({ error: "fileName and transactions required" });
      return;
    }

    try {

    const backupDir = join(dirname(dbPath), "backups");
    try {
      createBackup(dbPath, backupDir);
      cleanOldBackups(backupDir, 10);
    } catch {
      // Backup failure should not block import
    }

    let imported = 0;
    let duplicatesSkipped = 0;
    let fileId = 0;

    const insertFile = db.prepare(
      "INSERT INTO import_files (fileName, rowCount, duplicateCount) VALUES (?, ?, ?)"
    );

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (sourceFileId, transactionDate, valueDate, amount, direction, startBalance, endBalance, rawDescription, merchantName, categoryId, isRecurring, fingerprint, confidence, categorisationMethod, isReviewed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      const seen = new Set<string>();
      const nonDuplicates = transactions.filter((t) => {
        if (seen.has(t.fingerprint)) {
          duplicatesSkipped++;
          return false;
        }
        const existing = db.prepare("SELECT id FROM transactions WHERE fingerprint = ?").get(t.fingerprint);
        if (existing) {
          duplicatesSkipped++;
          return false;
        }
        seen.add(t.fingerprint);
        return true;
      });

      const fileResult = insertFile.run(fileName, nonDuplicates.length, duplicatesSkipped);
      fileId = Number(fileResult.lastInsertRowid);

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

    // Respond immediately — don't wait for AI
    res.json({
      imported,
      duplicatesSkipped,
      fileName,
      aiStatus: "processing",
    });

    // AI categorisation runs as a separate child process
    const uncategorisedCount = db.prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE sourceFileId = ? AND categorisationMethod IS NULL"
    ).get(fileId) as { count: number };

    if (uncategorisedCount.count > 0) {
      console.log(`[Import] File ${fileId}: ${imported} imported, spawning AI categorisation for ${uncategorisedCount.count} transactions...`);

      // Spawn categorise-pending.ts as a detached child process
      const scriptPath = join(dirname(new URL(import.meta.url).pathname), "../../categorise-pending.ts");
      const child = spawn("npx", ["tsx", scriptPath], {
        cwd: join(dirname(new URL(import.meta.url).pathname), "../.."),
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      });
      child.unref();
      console.log(`[Import] AI child process spawned (PID: ${child.pid})`);
    }
  } catch (err: any) {
    console.error("Import confirm error:", err.message);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
  });

  router.get("/status", (_req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM transactions").get() as any;
    const uncategorised = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE categorisationMethod IS NULL").get() as any;
    const failed = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE categorisationMethod = 'failed'").get() as any;
    const aiDone = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE categorisationMethod = 'ai'").get() as any;

    const isProcessing = uncategorised.count > 0;

    res.json({
      total: total.count,
      categorised: aiDone.count,
      uncategorised: uncategorised.count,
      failed: failed.count,
      isProcessing,
    });
  });

  return router;
}
