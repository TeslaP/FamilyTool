import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface Config {
  authUsername: string;
  authPassword: string;
  jwtSecret: string;
  dbPath: string;
  openaiApiKey: string | undefined;
  debugMode: boolean;
  port: number;
  aiEnabled: boolean;
  aiModel: string;
  aiSummaryModel: string;
  aiMaxConcurrent: number;
  aiTimeoutMs: number;
}

export function loadConfig(): Config {
  const dbPath = process.env.DB_PATH || "./data/familytool.sqlite";
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return {
    authUsername: process.env.AUTH_USERNAME || "admin",
    authPassword: process.env.AUTH_PASSWORD || "changeme",
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    dbPath,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    debugMode: process.env.DEBUG_MODE === "true",
    port: parseInt(process.env.PORT || "3001", 10),
    aiEnabled: !!process.env.OPENAI_API_KEY,
    aiModel: process.env.AI_MODEL || "gpt-4o-mini",
    aiSummaryModel: process.env.AI_SUMMARY_MODEL || "gpt-4o",
    aiMaxConcurrent: parseInt(process.env.AI_MAX_CONCURRENT || "3", 10),
    aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "30000", 10),
  };
}
