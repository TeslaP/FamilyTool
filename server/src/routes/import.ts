import { Router } from "express";
import type Database from "better-sqlite3";
import type { Multer } from "multer";
import { dirname, join } from "path";
import { parseTabFile, parseXlsFile, type ParsedTransaction } from "../services/parser.js";
import { generateFingerprint } from "../services/fingerprint.js";
import { matchRules } from "../services/rules.js";
import { createBackup, cleanOldBackups } from "../services/backup.js";
import { categoriseTransactions } from "../ai/categoriser.js";
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

    // AI categorisation for uncategorised transactions
    const uncategorised = db.prepare(
      "SELECT id, rawDescription FROM transactions WHERE sourceFileId = ? AND categorisationMethod IS NULL"
    ).all(fileId) as { id: number; rawDescription: string }[];

    let aiCategorised = 0;
    let aiFailed = 0;

    if (uncategorised.length > 0) {
      const aiInput = uncategorised.map((t, i) => ({ index: i, rawDescription: t.rawDescription }));

      try {
        const aiResult = await categoriseTransactions(db, aiInput);

        // Apply AI results
        const updateStmt = db.prepare(
          "UPDATE transactions SET merchantName = ?, categoryId = ?, direction = ?, isRecurring = ?, confidence = ?, categorisationMethod = 'ai' WHERE id = ?"
        );

        for (const [index, result] of aiResult.results) {
          const txId = uncategorised[index].id;
          updateStmt.run(result.merchantName, result.categoryId, result.direction, result.isRecurring ? 1 : 0, result.confidence, txId);
          aiCategorised++;
        }

        // Apply cached results
        for (const [index, cached] of aiResult.cached) {
          const txId = uncategorised[index].id;
          updateStmt.run(cached.merchantName, cached.categoryId, cached.direction, cached.isRecurring ? 1 : 0, cached.confidence, txId);
          aiCategorised++;
        }

        // Mark failed
        const failStmt = db.prepare("UPDATE transactions SET categorisationMethod = 'failed' WHERE id = ?");
        for (const index of aiResult.failed) {
          const txId = uncategorised[index].id;
          failStmt.run(txId);
          aiFailed++;
        }
      } catch {
        // AI failure should not break the import
        const failStmt = db.prepare("UPDATE transactions SET categorisationMethod = 'failed' WHERE id = ?");
        for (const t of uncategorised) {
          failStmt.run(t.id);
        }
        aiFailed = uncategorised.length;
      }

      // Recalculate affected months
      const dates = db.prepare("SELECT DISTINCT transactionDate FROM transactions WHERE sourceFileId = ?").all(fileId) as { transactionDate: string }[];
      recalculateAffectedMonths(db, dates.map((d) => d.transactionDate));
    }

    // Update import file stats
    db.prepare("UPDATE import_files SET aiRequestCount = ? WHERE id = ?").run(aiCategorised + aiFailed, fileId);

    res.json({
      imported,
      duplicatesSkipped,
      aiCategorised,
      aiFailed,
      fileName,
    });
  } catch (err: any) {
    console.error("Import confirm error:", err.message);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
  });

  return router;
}
