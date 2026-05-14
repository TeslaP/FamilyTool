import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { LayoutDashboard } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { MonthSelector } from "../components/MonthSelector";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { formatCurrency, getCurrentMonth, cn } from "../lib/utils";

export function Dashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [mode, setMode] = useState<"overview" | "detail">("overview");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const navigate = useNavigate();

  const { data: transactions, loading, error } = useApi(
    () => api.getTransactions({ month }),
    [month]
  );
  const { data: categories } = useApi(() => api.getCategories(), []);

  // Calculate metrics
  const totalIncome =
    transactions
      ?.filter((t) => t.direction === "income")
      .reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpenses =
    transactions
      ?.filter((t) => t.direction === "expense")
      .reduce((s, t) => s + t.amount, 0) ?? 0;
  const netCashflow = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

  // Category chart data
  const categoryTotals = new Map<string, { amount: number; id: number }>();
  transactions
    ?.filter((t) => t.direction === "expense" && t.categoryId)
    .forEach((t) => {
      const cat = categories?.find((c) => c.id === t.categoryId);
      if (!cat) return;
      // Use the parent category if there is one, otherwise the category itself
      const parentCat = cat.parentId ? categories?.find((c) => c.id === cat.parentId) : cat;
      const name = parentCat?.name || cat.name;
      const id = parentCat?.id || cat.id;
      const existing = categoryTotals.get(name);
      categoryTotals.set(name, {
        amount: (existing?.amount || 0) + t.amount,
        id,
      });
    });
  const chartData = Array.from(categoryTotals.entries())
    .map(([name, { amount, id }]) => ({ name, amount: Math.round(amount), id }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // Top merchants
  const merchantTotals = new Map<string, number>();
  transactions
    ?.filter((t) => t.direction === "expense" && t.merchantName)
    .forEach((t) => {
      merchantTotals.set(
        t.merchantName!,
        (merchantTotals.get(t.merchantName!) || 0) + t.amount
      );
    });
  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await api.generateSummary(month);
      setSummary(res.summary);
    } catch {
      setSummary("Failed to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-stone-500">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">Error: {error}</div>
    );
  }

  const isEmpty = !transactions || transactions.length === 0;

  return (
    <div className="p-6 bg-stone-50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <MonthSelector month={month} onChange={setMonth} />
        <div className="flex border border-stone-200 rounded-lg overflow-hidden text-sm">
          <button
            className={cn(
              "px-4 py-2",
              mode === "overview"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600"
            )}
            onClick={() => setMode("overview")}
          >
            Overview
          </button>
          <button
            className={cn(
              "px-4 py-2",
              mode === "detail"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600"
            )}
            onClick={() => setMode("detail")}
          >
            Detail
          </button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<LayoutDashboard size={32} />}
          title="No transactions this month"
          description="Import a bank export to see your financial overview here."
          action={
            <Link
              to="/import"
              className="inline-flex px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800"
            >
              Import transactions
            </Link>
          }
        />
      ) : mode === "overview" ? (
        <OverviewMode
          netCashflow={netCashflow}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          savingsRate={savingsRate}
          chartData={chartData}
          month={month}
          summary={summary}
          summaryLoading={summaryLoading}
          onGenerateSummary={handleGenerateSummary}
          onCategoryClick={(id) => navigate(`/drilldown?month=${month}&category=${id}`)}
        />
      ) : (
        <DetailMode
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          netCashflow={netCashflow}
          savingsRate={savingsRate}
          chartData={chartData}
          topMerchants={topMerchants}
          summary={summary}
          summaryLoading={summaryLoading}
          onGenerateSummary={handleGenerateSummary}
          month={month}
          onCategoryClick={(id) => navigate(`/drilldown?month=${month}&category=${id}`)}
        />
      )}
    </div>
  );
}

// --- Overview Mode ---

function OverviewMode({
  netCashflow,
  totalIncome,
  totalExpenses,
  savingsRate,
  chartData,
  month,
  summary,
  summaryLoading,
  onGenerateSummary,
  onCategoryClick,
}: {
  netCashflow: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  chartData: { name: string; amount: number; id: number }[];
  month: string;
  summary: string | null;
  summaryLoading: boolean;
  onGenerateSummary: () => void;
  onCategoryClick: (id: number) => void;
}) {
  return (
    <div>
      {/* Hero metric */}
      <div className="text-center py-16">
        <p className="text-base text-stone-400 mb-3">
          Available this month
        </p>
        <p
          className={cn(
            "text-7xl font-light tracking-tight",
            netCashflow >= 0 ? "text-green-700" : "text-red-600"
          )}
        >
          {formatCurrency(netCashflow)}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-stone-500">
          <span>
            Income: <span className="font-medium">{formatCurrency(totalIncome)}</span>
          </span>
          <span>
            Expenses: <span className="font-medium">{formatCurrency(totalExpenses)}</span>
          </span>
          <span>
            <span className="font-medium">{savingsRate}%</span> saved
          </span>
        </div>
      </div>

      {/* AI Reflection */}
      <div className="text-center">
        {summary ? (
          <p className="text-stone-500 text-sm leading-relaxed max-w-lg mx-auto">
            {summary}
          </p>
        ) : (
          <button
            onClick={onGenerateSummary}
            disabled={summaryLoading}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
          >
            {summaryLoading ? "Generating..." : "Reflect on this month →"}
          </button>
        )}
      </div>

      {/* Full-width category bar chart */}
      {chartData.length > 0 && (
        <div className="mt-8 bg-white border border-stone-200 rounded-xl p-8">
          <h3 className="text-sm font-medium text-stone-700 mb-4">
            Spending by Category
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Amount"]}
              />
              <Bar
                dataKey="amount"
                fill="#57534e"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data: any) => {
                  if (data?.id) onCategoryClick(data.id);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// --- Detail Mode ---

function DetailMode({
  totalIncome,
  totalExpenses,
  netCashflow,
  savingsRate,
  chartData,
  topMerchants,
  summary,
  summaryLoading,
  onGenerateSummary,
  month,
  onCategoryClick,
}: {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;
  chartData: { name: string; amount: number; id: number }[];
  topMerchants: [string, number][];
  summary: string | null;
  summaryLoading: boolean;
  onGenerateSummary: () => void;
  month: string;
  onCategoryClick: (id: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Income" value={formatCurrency(totalIncome)} />
        <MetricCard label="Expenses" value={formatCurrency(totalExpenses)} />
        <MetricCard
          label="Net Cashflow"
          value={formatCurrency(netCashflow)}
          change={
            netCashflow >= 0
              ? { value: formatCurrency(netCashflow), positive: true }
              : { value: formatCurrency(Math.abs(netCashflow)), positive: false }
          }
        />
        <MetricCard label="Savings Rate" value={`${savingsRate}%`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category bar chart */}
        {chartData.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-stone-700 mb-3">
              Spending by Category
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 70 }}>
                <XAxis type="number" tickFormatter={(v) => `€${v}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={70}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Amount"]}
                />
                <Bar
                  dataKey="amount"
                  fill="#57534e"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data: any) => {
                    if (data?.id) onCategoryClick(data.id);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trend chart placeholder */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-stone-700 mb-3">
            Monthly Trend
          </h3>
          <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
            Trend data available after 2+ months of imports
          </div>
        </div>
      </div>

      {/* Top merchants */}
      {topMerchants.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-stone-700 mb-3">
            Top Merchants
          </h3>
          <div className="space-y-2">
            {topMerchants.map(([name, amount]) => (
              <div
                key={name}
                className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0"
              >
                <span className="text-sm text-stone-700">{name}</span>
                <span className="text-sm font-medium text-stone-900">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-stone-700">AI Summary</h3>
          <button
            onClick={onGenerateSummary}
            disabled={summaryLoading}
            className="text-xs px-3 py-1 bg-stone-900 text-white rounded hover:bg-stone-800 disabled:opacity-50"
          >
            {summaryLoading ? "Generating..." : "Generate"}
          </button>
        </div>
        {summary ? (
          <p className="text-sm text-stone-600 whitespace-pre-wrap">{summary}</p>
        ) : (
          <p className="text-sm text-stone-400">
            Click "Generate" to get an AI-powered summary of your spending patterns.
          </p>
        )}
      </div>
    </div>
  );
}
