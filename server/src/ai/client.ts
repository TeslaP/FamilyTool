import OpenAI from "openai";
import { loadConfig } from "../config.js";

let client: OpenAI | null = null;

export function getAiClient(): OpenAI | null {
  const config = loadConfig();
  if (!config.aiEnabled) return null;

  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export function isAiEnabled(): boolean {
  return loadConfig().aiEnabled;
}
