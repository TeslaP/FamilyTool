import type Database from "better-sqlite3";

export interface RuleMatch {
  ruleId: number;
  merchantName: string;
  categoryId: number;
  direction: "income" | "expense" | "transfer";
  confidence: number;
}

interface RuleRow {
  id: number;
  matchType: string;
  matchValue: string;
  merchantName: string;
  categoryId: number;
  direction: string;
  confidence: number;
}

export function matchRules(db: Database.Database, description: string): RuleMatch | null {
  const rules = db.prepare(
    "SELECT id, matchType, matchValue, merchantName, categoryId, direction, confidence FROM categorisation_rules ORDER BY confidence DESC"
  ).all() as RuleRow[];

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case "exact":
        matched = description.includes(rule.matchValue) && rule.matchValue.length > 0;
        break;
      case "contains":
        matched = description.toLowerCase().includes(rule.matchValue.toLowerCase());
        break;
      case "regex":
        try {
          matched = new RegExp(rule.matchValue, "i").test(description);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      db.prepare("UPDATE categorisation_rules SET usageCount = usageCount + 1 WHERE id = ?").run(rule.id);
      return {
        ruleId: rule.id,
        merchantName: rule.merchantName,
        categoryId: rule.categoryId,
        direction: rule.direction as "income" | "expense" | "transfer",
        confidence: rule.confidence,
      };
    }
  }

  return null;
}
