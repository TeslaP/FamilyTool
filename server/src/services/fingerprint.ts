import { createHash } from "crypto";

export function generateFingerprint(
  transactionDate: string,
  amount: number,
  description: string
): string {
  const descPrefix = description.slice(0, 50);
  const input = `${transactionDate}|${amount}|${descPrefix}`;
  return createHash("sha256").update(input).digest("hex");
}
