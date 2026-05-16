import type Database from "better-sqlite3";

export interface TrendSignal {
  category: string;
  direction: "up" | "down" | "stable";
  changePercent: number;
  months: number;
}

export interface PromptContext {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;
  topCategories: { name: string; amount: number }[];
  intention?: string;
  previousNote?: string;
  // Trend context
  trends: TrendSignal[];
  monthOverMonth: { incomeChange: number; expenseChange: number };
  savingsTrajectory: "improving" | "declining" | "stable";
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

  if (ctx.trends.length > 0) {
    user += `\n\nNotable trends vs previous month:\n${ctx.trends.map(t =>
      `- ${t.category}: ${t.direction} (${t.changePercent > 0 ? "+" : ""}${t.changePercent}%)`
    ).join("\n")}`;
  }

  user += `\n\nMonth-over-month: income ${ctx.monthOverMonth.incomeChange > 0 ? "+" : ""}${ctx.monthOverMonth.incomeChange}%, expenses ${ctx.monthOverMonth.expenseChange > 0 ? "+" : ""}${ctx.monthOverMonth.expenseChange}%`;
  user += `\nSavings trajectory: ${ctx.savingsTrajectory}`;

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

  // Previous month logic
  function prevMonth(m: string): string {
    const [y, mo] = m.split("-").map(Number);
    if (mo === 1) return `${y - 1}-12`;
    return `${y}-${String(mo - 1).padStart(2, "0")}`;
  }

  // Get previous month totals
  const prev = prevMonth(month);
  const prevTransactions = db.prepare(
    "SELECT amount, direction, categoryId FROM transactions WHERE substr(transactionDate, 1, 7) = ?"
  ).all(prev) as { amount: number; direction: string; categoryId: number | null }[];

  const prevIncome = prevTransactions.filter(t => t.direction === "income").reduce((s, t) => s + t.amount, 0);
  const prevExpenses = prevTransactions.filter(t => t.direction === "expense").reduce((s, t) => s + t.amount, 0);

  const incomeChange = prevIncome > 0 ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100) : 0;
  const expenseChange = prevExpenses > 0 ? Math.round(((totalExpenses - prevExpenses) / prevExpenses) * 100) : 0;

  // Category trends (compare this month to prev month per category)
  const prevCatTotals = new Map<number, number>();
  prevTransactions.filter(t => t.direction === "expense" && t.categoryId).forEach(t => {
    prevCatTotals.set(t.categoryId!, (prevCatTotals.get(t.categoryId!) || 0) + t.amount);
  });

  const trends: TrendSignal[] = [];
  for (const [id, amount] of catTotals) {
    const prevAmount = prevCatTotals.get(id) || 0;
    const name = catMap.get(id) || "Other";
    if (prevAmount === 0 && amount > 100) {
      trends.push({ category: name, direction: "up", changePercent: 100, months: 1 });
    } else if (prevAmount > 0) {
      const change = Math.round(((amount - prevAmount) / prevAmount) * 100);
      if (change > 20) trends.push({ category: name, direction: "up", changePercent: change, months: 1 });
      else if (change < -20) trends.push({ category: name, direction: "down", changePercent: change, months: 1 });
      else trends.push({ category: name, direction: "stable", changePercent: change, months: 1 });
    }
  }
  // Only keep notable trends (not stable ones)
  const notableTrends = trends.filter(t => t.direction !== "stable").slice(0, 5);

  // Savings trajectory
  const prevSavingsRate = prevIncome > 0 ? Math.round(((prevIncome - prevExpenses) / prevIncome) * 100) : 0;
  const savingsTrajectory: "improving" | "declining" | "stable" =
    savingsRate > prevSavingsRate + 5 ? "improving" :
    savingsRate < prevSavingsRate - 5 ? "declining" : "stable";

  return {
    month,
    totalIncome,
    totalExpenses,
    netCashflow,
    savingsRate,
    topCategories,
    intention,
    previousNote: prevSession?.closingNote || undefined,
    trends: notableTrends,
    monthOverMonth: { incomeChange, expenseChange },
    savingsTrajectory,
  };
}
