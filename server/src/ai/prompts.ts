import type Database from "better-sqlite3";

export interface PromptContext {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;
  topCategories: { name: string; amount: number }[];
  intention?: string;
  previousNote?: string;
}

export function buildReflectionPrompt(ctx: PromptContext): { system: string; user: string } {
  const system = `You are a calm financial observer for a family household. You write short, structured monthly reflections.

RULES:
- Tone: calm, observational, non-judgmental. Like a thoughtful friend noting patterns.
- NEVER use: "you should", "try to", "I recommend", "great job", exclamation marks
- NEVER give financial advice or motivational language
- Structure your response as exactly 4 short paragraphs (no headers, no labels):
  1. What happened this month (objective observations about spending/income)
  2. Pacing (when spending happened — early/late in month, any rhythm)
  3. Context (connect to the user's intention if provided, or note patterns)
  4. Gentle closing (one sentence framing the month's character)
- Total length: 4-6 sentences. Be concise.
- Write in third-person observational style, not "you did X" — more like "spending increased" or "the month felt..."`;

  let user = `Monthly financial data for ${ctx.month}:

Income: €${ctx.totalIncome.toFixed(2)}
Expenses: €${ctx.totalExpenses.toFixed(2)}
Net: €${ctx.netCashflow.toFixed(2)}
Savings rate: ${ctx.savingsRate}%

Top spending categories:
${ctx.topCategories.map(c => `- ${c.name}: €${c.amount.toFixed(2)}`).join("\n")}`;

  if (ctx.intention) {
    user += `\n\nUser's intention for this session: "${ctx.intention}"`;
  }

  if (ctx.previousNote) {
    user += `\n\nNote from previous month's reflection: "${ctx.previousNote}"`;
  }

  user += `\n\nWrite the 4-paragraph reflection now.`;

  return { system, user };
}

export function buildDetailAnalysisPrompt(ctx: PromptContext): { system: string; user: string } {
  const system = `You are a factual financial analyst. Write a brief analysis of spending patterns. No emotional framing. Just observations about trends, anomalies, and notable changes. 3-4 sentences max.`;

  const user = `Month: ${ctx.month}
Income: €${ctx.totalIncome.toFixed(2)}
Expenses: €${ctx.totalExpenses.toFixed(2)}
Net: €${ctx.netCashflow.toFixed(2)}

Categories:
${ctx.topCategories.map(c => `- ${c.name}: €${c.amount.toFixed(2)}`).join("\n")}

Provide a brief factual analysis.`;

  return { system, user };
}

export function gatherPromptContext(db: Database.Database, month: string, intention?: string): PromptContext {
  const transactions = db.prepare(
    "SELECT amount, direction, categoryId FROM transactions WHERE substr(transactionDate, 1, 7) = ?"
  ).all(month) as { amount: number; direction: string; categoryId: number | null }[];

  const totalIncome = transactions.filter(t => t.direction === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.direction === "expense").reduce((s, t) => s + t.amount, 0);
  const netCashflow = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

  // Top categories
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

  // Get previous session note
  const prevSession = db.prepare(
    "SELECT closingNote FROM session_reflections WHERE month < ? ORDER BY month DESC LIMIT 1"
  ).get(month) as { closingNote: string } | undefined;

  return {
    month,
    totalIncome,
    totalExpenses,
    netCashflow,
    savingsRate,
    topCategories,
    intention,
    previousNote: prevSession?.closingNote || undefined,
  };
}
