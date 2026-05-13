import type Database from "better-sqlite3";

export function buildCategorisationPrompt(
  descriptions: string[],
  categories: { id: number; name: string; parentName: string | null; type: string }[]
): string {
  const categoryList = categories
    .map((c) => `${c.id}: ${c.parentName ? c.parentName + " > " : ""}${c.name} (${c.type})`)
    .join("\n");

  const transactionList = descriptions
    .map((d, i) => `${i}: ${d}`)
    .join("\n");

  return `You are a financial transaction categoriser for a Dutch family household.

Categorise each transaction below. For each, provide:
- merchantName: cleaned merchant name (e.g. "Albert Heijn", "NS", "Ziggo")
- categoryId: one of the allowed category IDs below
- direction: "income", "expense", or "transfer"
- isRecurring: true if this appears to be a recurring payment
- confidence: 0.0 to 1.0 how confident you are

ALLOWED CATEGORIES (you MUST use one of these IDs):
${categoryList}

TRANSACTIONS TO CATEGORISE:
${transactionList}

Respond with ONLY a JSON array. Each item must have: index, merchantName, categoryId, direction, isRecurring, confidence.
No explanation, no markdown, just the JSON array.`;
}

export function getLeafCategories(db: Database.Database): { id: number; name: string; parentName: string | null; type: string }[] {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.type, p.name as parentName
    FROM categories c
    LEFT JOIN categories p ON c.parentId = p.id
    WHERE c.isActive = 1 AND c.parentId IS NOT NULL
    ORDER BY c.sortOrder, c.name
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentName: r.parentName,
    type: r.type,
  }));
}
