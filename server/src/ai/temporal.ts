import { createHash } from "crypto";
import type Database from "better-sqlite3";
import OpenAI from "openai";
import { loadConfig } from "../config.js";

export interface TemporalReflectionRow {
  id: number;
  periodStart: string;
  periodEnd: string;
  reflection: string;
  inputHash: string | null;
  generatedAt: string;
  updatedAt: string | null;
}

interface PeriodData {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  topCategories: { name: string; amount: number }[];
  transactionCount: number;
}

function getMonthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function getScopeDepth(months: number): { maxSentences: number; instruction: string } {
  if (months <= 1) return { maxSentences: 1, instruction: "Generate a single sentence (6-12 words) capturing this month's financial character. Like a chapter title." };
  if (months <= 3) return { maxSentences: 2, instruction: "Generate 2 short sentences observing pacing and shifts over this period." };
  if (months <= 6) return { maxSentences: 4, instruction: "Generate 3-4 sentences interpreting patterns and trajectory over this period." };
  return { maxSentences: 5, instruction: "Generate 4-5 sentences capturing the shape of this year financially. Note seasonal patterns if visible." };
}

export function gatherPeriodData(db: Database.Database, from: string, to: string): PeriodData {
  const transactions = db.prepare(`
    SELECT amount, direction, categoryId FROM transactions
    WHERE substr(transactionDate, 1, 7) >= ? AND substr(transactionDate, 1, 7) <= ?
  `).all(from, to) as { amount: number; direction: string; categoryId: number | null }[];

  const totalIncome = transactions.filter(t => t.direction === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.direction === "expense").reduce((s, t) => s + t.amount, 0);

  const catTotals = new Map<number, number>();
  transactions.filter(t => t.direction === "expense" && t.categoryId).forEach(t => {
    catTotals.set(t.categoryId!, (catTotals.get(t.categoryId!) || 0) + t.amount);
  });

  const categories = db.prepare("SELECT id, name FROM categories WHERE parentId IS NOT NULL").all() as { id: number; name: string }[];
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const topCategories = Array.from(catTotals.entries())
    .map(([id, amount]) => ({ name: catMap.get(id) || "Other", amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netCashflow: Math.round((totalIncome - totalExpenses) * 100) / 100,
    topCategories,
    transactionCount: transactions.length,
  };
}

export function computeInputHash(data: PeriodData): string {
  const input = JSON.stringify({
    income: Math.round(data.totalIncome),
    expenses: Math.round(data.totalExpenses),
    categories: data.topCategories.map(c => `${c.name}:${Math.round(c.amount)}`),
    count: data.transactionCount,
  });
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export async function generateTemporalReflection(db: Database.Database, from: string, to: string): Promise<string> {
  const config = loadConfig();
  if (!config.aiEnabled) {
    return "AI unavailable — add OPENAI_API_KEY to generate reflections.";
  }

  const data = gatherPeriodData(db, from, to);
  const months = getMonthDiff(from, to);
  const { instruction } = getScopeDepth(months);

  const systemPrompt = `You are a calm financial observer. You write very short reflections about financial periods.

RULES:
- ${instruction}
- Be observational, not evaluative. No advice. No motivation.
- No numbers in the output. Describe character and patterns in words.
- Never use: "you should", "great job", exclamation marks, "I recommend"
- Tone: like a quiet margin note in a notebook`;

  const userPrompt = `Period: ${from} to ${to} (${months} month${months > 1 ? "s" : ""})

Income: €${data.totalIncome.toFixed(0)}
Expenses: €${data.totalExpenses.toFixed(0)}
Net: €${data.netCashflow.toFixed(0)}

Top categories:
${data.topCategories.map(c => `- ${c.name}: €${c.amount.toFixed(0)}`).join("\n")}

Write the reflection now.`;

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.chat.completions.create({
    model: config.aiSummaryModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 150,
  });

  return response.choices[0]?.message?.content?.trim() || "Unable to generate reflection.";
}
