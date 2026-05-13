export interface AiCategorisationResult {
  index: number;
  merchantName: string;
  categoryId: number;
  direction: "income" | "expense" | "transfer";
  isRecurring: boolean;
  confidence: number;
}

export interface ValidationResult {
  valid: boolean;
  items?: AiCategorisationResult[];
  error?: string;
}

const VALID_DIRECTIONS = ["income", "expense", "transfer"];

export function validateAiResponse(
  raw: string,
  expectedCount: number,
  validCategoryIds: number[]
): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "Failed to parse JSON response" };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: "Response must be a JSON array" };
  }

  if (parsed.length !== expectedCount) {
    return { valid: false, error: `Expected ${expectedCount} items, got ${parsed.length} (count mismatch)` };
  }

  const items: AiCategorisationResult[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];

    if (
      item.index === undefined ||
      !item.merchantName ||
      item.categoryId === undefined ||
      !item.direction ||
      item.isRecurring === undefined ||
      item.confidence === undefined
    ) {
      return { valid: false, error: `Item ${i} has missing required fields` };
    }

    if (!validCategoryIds.includes(item.categoryId)) {
      return { valid: false, error: `Item ${i} has invalid category ID ${item.categoryId}` };
    }

    if (!VALID_DIRECTIONS.includes(item.direction)) {
      return { valid: false, error: `Item ${i} has invalid direction "${item.direction}"` };
    }

    if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) {
      return { valid: false, error: `Item ${i} has invalid confidence ${item.confidence} (must be 0.0-1.0)` };
    }

    items.push({
      index: item.index,
      merchantName: item.merchantName,
      categoryId: item.categoryId,
      direction: item.direction,
      isRecurring: !!item.isRecurring,
      confidence: item.confidence,
    });
  }

  return { valid: true, items };
}
