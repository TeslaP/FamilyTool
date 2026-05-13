import { describe, it, expect } from "vitest";
import { parseTabFile, parseXlsFile, type ParsedTransaction } from "../src/services/parser.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, "../../samples");

describe("parseTabFile", () => {
  it("parses 3-row TAB file into transactions", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result).toHaveLength(3);
  });

  it("normalises comma decimal to float", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].amount).toBe(49.75);
    expect(result[1].amount).toBe(2500.0);
  });

  it("formats dates as YYYY-MM-DD", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].transactionDate).toBe("2026-01-01");
    expect(result[0].valueDate).toBe("2026-01-01");
  });

  it("detects direction from amount sign", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].direction).toBe("expense");
    expect(result[1].direction).toBe("income");
  });

  it("stores amount as absolute value", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].amount).toBe(49.75);
    expect(result[2].amount).toBe(50.0);
  });

  it("preserves raw description", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].rawDescription).toContain("Albert Heijn");
  });

  it("parses start and end balance", () => {
    const content = readFileSync(join(samplesDir, "test-3rows.tab"), "utf-8");
    const result = parseTabFile(content);
    expect(result[0].startBalance).toBe(1500.0);
    expect(result[0].endBalance).toBe(1450.25);
  });

  it("skips empty lines", () => {
    const content = "474774774\tEUR\t20260101\t1500,00\t1450,25\t20260101\t-49,75\tTest\n\n\n";
    const result = parseTabFile(content);
    expect(result).toHaveLength(1);
  });
});

describe("parseXlsFile", () => {
  it("parses 3-row XLS file into transactions", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);
    expect(result).toHaveLength(3);
  });

  it("handles dot decimal in XLS format", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);
    expect(result[0].amount).toBe(49.75);
    expect(result[1].amount).toBe(2500.0);
  });

  it("formats dates as YYYY-MM-DD", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);
    expect(result[0].transactionDate).toBe("2026-01-01");
  });

  it("detects direction from amount sign", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);
    expect(result[0].direction).toBe("expense");
    expect(result[1].direction).toBe("income");
  });

  it("stores amount as absolute value", () => {
    const buffer = readFileSync(join(samplesDir, "test-3rows.xls"));
    const result = parseXlsFile(buffer);
    expect(result[0].amount).toBe(49.75);
  });
});
