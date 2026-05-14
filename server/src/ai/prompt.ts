import type Database from "better-sqlite3";

export function buildCategorisationPrompt(
  descriptions: string[],
  categories: { id: number; name: string; parentName: string | null; type: string }[],
  knownRules?: { merchantName: string; category: string }[]
): string {
  const categoryList = categories
    .map((c) => `${c.id}: ${c.parentName ? c.parentName + " > " : ""}${c.name} (${c.type})`)
    .join("\n");

  const transactionList = descriptions
    .map((d, i) => `${i}: ${d}`)
    .join("\n");

  const examplesSection = knownRules && knownRules.length > 0
    ? `\nKNOWN MERCHANT → CATEGORY EXAMPLES (use these as reference):\n${knownRules.slice(0, 50).map(r => `- "${r.merchantName}" → ${r.category}`).join("\n")}\n`
    : "";

  return `You are a financial transaction categoriser for a Dutch family household based in Amsterdam.

CONTEXT:
- Bank: ABN AMRO (Netherlands)
- Transaction formats: SEPA (transfers/direct debits), BEA (pin/Apple Pay), eCom (online), iDEAL
- Family: two adults, children, typical Amsterdam household expenses

YOUR TASK:
Categorise each transaction. For each, determine:
- merchantName: the cleaned merchant/company name (e.g. "Albert Heijn", "NS", "Ziggo", "ABN AMRO")
- categoryId: one of the allowed category IDs below
- direction: "income", "expense", or "transfer"
- isRecurring: true if this is clearly a recurring payment (subscriptions, mortgage, insurance, childcare, utilities)
- confidence: 0.0 to 1.0

DIRECTION RULES (critical):
- "transfer": Money moving between the family's OWN accounts. Indicators:
  - Naam contains family member names (PK TESLENKO, Kopilka)
  - Savings account transfers
  - Credit card payments to "International Card Services" or "INT CARD SERVICES"
  - Investment purchases (BUY VNGRD, ETF purchases)
- "income": Money coming IN from external sources (salary, freelance, child benefits, refunds, dividends)
  - Indicators: positive amount, employers, SVB (Sociale Verzekeringsbank), tax refunds
- "expense": Money going OUT to external parties (shops, services, subscriptions)
  - This is the default for most transactions

TRANSFER DETECTION (family's own accounts):
These are ALWAYS "transfer" direction:
- "PK TESLENKO" (any variation) — internal family transfer
- "Kopilka" — savings jar
- "International Card Services" or "INT CARD SERVICES" — credit card payment
- Any BUY/SELL of ETFs or investment funds → transfer to Investment category
- "VNGRD SP500 ETF" purchases → transfer/Investment

RECURRING DETECTION:
Mark as recurring (isRecurring: true):
- Mortgage payments (hypotheek)
- Insurance (verzekering)
- Childcare (kinderopvang)
- Utilities (Vattenfall, water)
- Telecom (ODIDO, Ziggo)
- Housing fees (VvE)
- Health insurance (Zilveren Kruis)

DUTCH BANKING PATTERNS:
- "BEA" = pin terminal payment (in-store purchase)
- "eCom" = online card payment
- "SEPA Incasso" = direct debit (usually recurring)
- "SEPA Overboeking" = bank transfer
- "SEPA iDEAL" = online payment via iDEAL
- "Naam:" field contains the merchant/recipient name
- "Omschrijving:" field contains the payment description
${examplesSection}
ALLOWED CATEGORIES (you MUST use one of these IDs — never invent new ones):
${categoryList}

TRANSACTIONS TO CATEGORISE:
${transactionList}

Respond with ONLY a valid JSON array. Each item must have exactly these fields: index, merchantName, categoryId, direction, isRecurring, confidence.
No explanation, no markdown code fences, no comments — just the raw JSON array.`;
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

export function getKnownRules(db: Database.Database): { merchantName: string; category: string }[] {
  const rows = db.prepare(`
    SELECT cr.merchantName, c.name as category
    FROM categorisation_rules cr
    JOIN categories c ON cr.categoryId = c.id
    ORDER BY cr.usageCount DESC
    LIMIT 50
  `).all() as any[];

  return rows.map((r) => ({
    merchantName: r.merchantName,
    category: r.category,
  }));
}
