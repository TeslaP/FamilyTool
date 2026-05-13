import type Database from "better-sqlite3";
import { getAiClient } from "./client.js";
import { loadConfig } from "../config.js";

export interface MonthlySummaryData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  netCashflow: number;
  categoryBreakdown: { category: string; amount: number; direction: string }[];
  previousMonth: { totalIncome: number; totalExpenses: number } | null;
}

export function gatherSummaryData(db: Database.Database, month: string): MonthlySummaryData {
  const aggregates = db.prepare(`
    SELECT ma.categoryId, ma.income, ma.expense, ma.transferOut, c.name as categoryName, c.type
    FROM monthly_aggregates ma
    JOIN categories c ON ma.categoryId = c.id
    WHERE ma.month = ?
  `).all(month) as any[];

  const totalIncome = aggregates.reduce((sum, a) => sum + a.income, 0);
  const totalExpenses = aggregates.reduce((sum, a) => sum + a.expense, 0);
  const totalTransfers = aggregates.reduce((sum, a) => sum + a.transferOut, 0);

  const categoryBreakdown = aggregates
    .filter((a) => a.expense > 0 || a.income > 0)
    .map((a) => ({
      category: a.categoryName,
      amount: a.expense > 0 ? a.expense : a.income,
      direction: a.type,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Previous month
  const [year, monthNum] = month.split("-").map(Number);
  const prevMonth = monthNum === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNum - 1).padStart(2, "0")}`;

  const prevAggregates = db.prepare(`
    SELECT SUM(income) as totalIncome, SUM(expense) as totalExpenses
    FROM monthly_aggregates WHERE month = ?
  `).get(prevMonth) as any;

  const previousMonth = prevAggregates?.totalIncome != null
    ? { totalIncome: prevAggregates.totalIncome, totalExpenses: prevAggregates.totalExpenses }
    : null;

  return {
    month,
    totalIncome,
    totalExpenses,
    totalTransfers,
    netCashflow: totalIncome - totalExpenses,
    categoryBreakdown,
    previousMonth,
  };
}

export async function generateMonthlySummary(db: Database.Database, month: string): Promise<string> {
  const client = getAiClient();
  if (!client) {
    return "AI summary unavailable — no OpenAI API key configured.";
  }

  const config = loadConfig();
  const data = gatherSummaryData(db, month);

  const prompt = `You are a calm, practical financial advisor for a family household.
Generate a brief monthly financial summary based on this data:

Month: ${data.month}
Total income: €${data.totalIncome.toFixed(2)}
Total expenses: €${data.totalExpenses.toFixed(2)}
Net cashflow: €${data.netCashflow.toFixed(2)}
Transfers (savings/investments): €${data.totalTransfers.toFixed(2)}

Top spending categories:
${data.categoryBreakdown.slice(0, 8).map((c) => `- ${c.category}: €${c.amount.toFixed(2)}`).join("\n")}

${data.previousMonth ? `Previous month comparison:
- Income: €${data.previousMonth.totalIncome.toFixed(2)} → €${data.totalIncome.toFixed(2)}
- Expenses: €${data.previousMonth.totalExpenses.toFixed(2)} → €${data.totalExpenses.toFixed(2)}` : "No previous month data available."}

Write 3-5 sentences. Be calm, practical, non-judgemental. Focus on notable changes and the overall financial health. Do not use exclamation marks or alarmist language.`;

  const response = await client.chat.completions.create({
    model: config.aiSummaryModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || "Unable to generate summary.";
}
