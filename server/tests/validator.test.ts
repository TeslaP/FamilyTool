import { describe, it, expect } from "vitest";
import { validateAiResponse, type AiCategorisationResult } from "../src/ai/validator.js";

const validCategoryIds = [2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("validateAiResponse", () => {
  it("accepts valid response", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Albert Heijn", categoryId: 2, direction: "expense", isRecurring: false, confidence: 0.85 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items![0].merchantName).toBe("Albert Heijn");
  });

  it("rejects non-JSON string", () => {
    const result = validateAiResponse("not json", 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("parse");
  });

  it("rejects non-array JSON", () => {
    const result = validateAiResponse('{"foo": "bar"}', 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("array");
  });

  it("rejects item with missing fields", () => {
    const raw = JSON.stringify([{ index: 0, merchantName: "Test" }]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing");
  });

  it("rejects invalid categoryId", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 999, direction: "expense", isRecurring: false, confidence: 0.8 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("category");
  });

  it("rejects invalid direction", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 2, direction: "invalid", isRecurring: false, confidence: 0.8 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("direction");
  });

  it("rejects confidence out of range", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "Test", categoryId: 2, direction: "expense", isRecurring: false, confidence: 1.5 }
    ]);
    const result = validateAiResponse(raw, 1, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("confidence");
  });

  it("rejects wrong item count", () => {
    const raw = JSON.stringify([
      { index: 0, merchantName: "A", categoryId: 2, direction: "expense", isRecurring: false, confidence: 0.8 },
      { index: 1, merchantName: "B", categoryId: 3, direction: "expense", isRecurring: false, confidence: 0.7 }
    ]);
    const result = validateAiResponse(raw, 3, validCategoryIds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("count");
  });
});
