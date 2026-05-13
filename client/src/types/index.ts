export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  type: "income" | "expense" | "transfer";
  sortOrder: number;
  isActive: number;
}

export interface Transaction {
  id: number;
  sourceFileId: number;
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
  merchantName: string | null;
  categoryId: number | null;
  isRecurring: number;
  fingerprint: string;
  confidence: number;
  categorisationMethod: "ai" | "rule" | "manual" | "failed" | null;
  isReviewed: number;
  createdAt: string;
}

export interface ImportPreview {
  rowCount: number;
  newCount: number;
  duplicateCount: number;
  dateRange: { from: string | null; to: string | null };
  transactions: PreviewTransaction[];
}

export interface PreviewTransaction {
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
  fingerprint: string;
  isDuplicate: boolean;
  ruleMatch: {
    merchantName: string;
    categoryId: number;
    direction: string;
    confidence: number;
  } | null;
}

export interface ImportResult {
  imported: number;
  duplicatesSkipped: number;
  aiCategorised: number;
  aiFailed: number;
  fileName: string;
}

export interface MonthlyAggregates {
  month: string;
  categoryId: number;
  income: number;
  expense: number;
  transferOut: number;
  recurringAmount: number;
  transactionCount: number;
}

export interface SummaryData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  netCashflow: number;
  categoryBreakdown: { category: string; amount: number; direction: string }[];
  previousMonth: { totalIncome: number; totalExpenses: number } | null;
}

export interface SummaryResponse {
  summary: string;
  data: SummaryData;
}
