import XLSX from "xlsx";

export interface ParsedTransaction {
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
}

function parseCommaDecimal(value: string): number {
  return parseFloat(value.replace(",", "."));
}

function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function detectDirection(amount: number): "income" | "expense" {
  return amount >= 0 ? "income" : "expense";
}

export function parseTabFile(content: string): ParsedTransaction[] {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const fields = line.split("\t");
    if (fields.length < 8) continue;

    const rawAmount = parseCommaDecimal(fields[6]);
    const direction = detectDirection(rawAmount);

    transactions.push({
      transactionDate: formatDate(fields[2]),
      valueDate: formatDate(fields[5]),
      amount: Math.abs(rawAmount),
      direction,
      startBalance: parseCommaDecimal(fields[3]),
      endBalance: parseCommaDecimal(fields[4]),
      rawDescription: fields[7].trim(),
    });
  }

  return transactions;
}

export function parseXlsFile(buffer: Buffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false });

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const rawAmount = parseFloat(row["amount"]);
    const direction = detectDirection(rawAmount);

    transactions.push({
      transactionDate: formatDate(row["transactiondate"]),
      valueDate: formatDate(row["valuedate"]),
      amount: Math.abs(rawAmount),
      direction,
      startBalance: parseFloat(row["startsaldo"]),
      endBalance: parseFloat(row["endsaldo"]),
      rawDescription: (row["description"] || "").trim(),
    });
  }

  return transactions;
}
