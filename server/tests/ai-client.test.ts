import { describe, it, expect, afterEach } from "vitest";
import { getAiClient, isAiEnabled } from "../src/ai/client.js";

describe("AI client", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("returns null when OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(getAiClient()).toBeNull();
  });

  it("reports AI disabled without key", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isAiEnabled()).toBe(false);
  });
});
