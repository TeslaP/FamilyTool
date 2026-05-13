import { describe, it, expect } from "vitest";
import { generateFingerprint } from "../src/services/fingerprint.js";

describe("generateFingerprint", () => {
  it("produces consistent hash for same inputs", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn Amsterdam");
    const fp2 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn Amsterdam");
    expect(fp1).toBe(fp2);
  });

  it("produces different hash for different dates", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn");
    const fp2 = generateFingerprint("2026-01-02", 49.75, "BEA Albert Heijn");
    expect(fp1).not.toBe(fp2);
  });

  it("produces different hash for different amounts", () => {
    const fp1 = generateFingerprint("2026-01-01", 49.75, "BEA Albert Heijn");
    const fp2 = generateFingerprint("2026-01-01", 50.00, "BEA Albert Heijn");
    expect(fp1).not.toBe(fp2);
  });

  it("uses only first 50 chars of description", () => {
    const desc = "A".repeat(100);
    const fp1 = generateFingerprint("2026-01-01", 49.75, desc);
    const fp2 = generateFingerprint("2026-01-01", 49.75, "A".repeat(50) + "B".repeat(50));
    expect(fp1).toBe(fp2);
  });

  it("returns a hex string", () => {
    const fp = generateFingerprint("2026-01-01", 49.75, "test");
    expect(fp).toMatch(/^[a-f0-9]+$/);
  });
});
