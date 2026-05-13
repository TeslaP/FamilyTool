import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export function createBackup(dbPath: string, backupDir: string): string {
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const backupPath = join(backupDir, `backup-${formatted}.sqlite`);

  copyFileSync(dbPath, backupPath);
  return backupPath;
}

export function cleanOldBackups(backupDir: string, keep: number): void {
  if (!existsSync(backupDir)) return;

  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sqlite"))
    .sort()
    .reverse();

  for (const file of files.slice(keep)) {
    unlinkSync(join(backupDir, file));
  }
}
