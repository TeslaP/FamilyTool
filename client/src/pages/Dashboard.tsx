import { useState, useEffect } from "react";
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
import { useMonthParam } from "../hooks/useMonthParam";
import { useCountUp } from "../hooks/useCountUp";
import { MonthSelector, type MonthRange } from "../components/MonthSelector";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";
import { FadeInSection } from "../components/FadeInSection";
import { TemporalReflectionBlock } from "../components/TemporalReflectionBlock";
import { formatCurrency, formatMonth, getNextMonth, cn } from "../lib/utils";
import type { Transaction, Category } from "../types";

// --- Weekly Pacing Section (fetches its own data) ---

function WeeklyPacingSection({ month }: { month: string }) {
  const { data, loading } = useApi(() => api.getPacing(month), [month]);

  if (loading || !data) return <div className="text-stone-400 text-sm">Loading weekly data...</div>;

  const { weeks, projection } = data;
  const trendColor = projection.trend === "tightening" ? "text-amber-600" :
                     projection.trend === "improving" ? "text-green-700" : "text-stone-500";

  return (
    <section>
      <h3 className="text-sm font-medium text-stone-700 mb-4">Weekly pacing</h3>
      <div className="space-y-2 mb-4">
        {weeks.map((week: any, i: number) => (
          <div key={week.weekNum} className="flex items-center gap-3 text-sm">
            <span className="text-stone-400 w-14">Week {week.weekNum}</span>
            <span className="text-stone-300">&middot;</span>
            <span className="text-stone-600">{formatCurrency(week.spent)} spent</span>
            <span className="text-stone-300">&middot;</span>
            <span className={cn("font-medium", week.remaining >= 0 ? "text-stone-900" : "text-red-600")}>
              {formatCurrency(week.remaining)} left
            </span>
            {i === weeks.length - 1 && <span className="w-1.5 h-1.5 rounded-full bg-stone-400 ml-1" />}
          </div>
        ))}
      </div>
      <p className="text-sm text-stone-400">
        Projected month-end: {formatCurrency(projection.remaining)} &middot; <span className={trendColor}>{projection.trend}</span>
      </p>
    </section>
  );
}

// --- Year Trajectory Section (fetches its own data) ---

function TrajectorySection({ year }: { year: number }) {
  const { data, loading } = useApi(() => api.getTrajectory(year), [year]);

  if (loading || !data) return <div className="text-stone-400 text-sm">Loading trajectory...</div>;

  const { currentYear, previousYear, totals } = data;
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const spendingData = currentYear.map((c: any, i: number) => ({
    month: MONTH_LABELS[i],
    current: Math.round(c.expenses),
    previous: Math.round(previousYear[i]?.expenses || 0),
  }));

  const investProgress = totals.investmentGoal > 0 ? Math.min(100, Math.round((totals.investmentActual / totals.investmentGoal) * 100)) : 0;
  const savingsProgress = totals.savingsGoal > 0 ? Math.min(100, Math.round((totals.savingsActual / totals.savingsGoal) * 100)) : 0;

  return (
    <section>
      <h3 className="text-sm font-medium text-stone-700 mb-4">Year trajectory &mdash; {year}</h3>

      {/* Savings progress */}
      {(totals.investmentGoal > 0 || totals.savingsGoal > 0) && (
        <div className="space-y-3 mb-8">
          {totals.investmentGoal > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-600">Investment</span>
                <span className="text-stone-500">{formatCurrency(totals.investmentActual)} / {formatCurrency(totals.investmentGoal)}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-stone-700 rounded-full" style={{ width: `${investProgress}%` }} />
              </div>
            </div>
          )}
          {totals.savingsGoal > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-600">Savings</span>
                <span className="text-stone-500">{formatCurrency(totals.savingsActual)} / {formatCurrency(totals.savingsGoal)}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-stone-500 rounded-full" style={{ width: `${savingsProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly spending YoY */}
      <div className="bg-white border border-stone-100 rounded-xl p-6">
        <p className="text-sm text-stone-500 mb-4">Monthly spending</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={spendingData} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="previous" fill="#e7e5e4" radius={[3, 3, 0, 0]} name={`${year - 1}`} />
            <Bar dataKey="current" fill="#57534e" radius={[3, 3, 0, 0]} name={`${year}`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { month, range, setMonth, setRange } = useMonthParam();
  const [mode, setMode] = useState<"overview" | "detail">("overview");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [openReflection, setOpenReflection] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setIsTransitioning(false); }, []);

  const handleStartSession = () => {
    setIsTransitioning(true);
    setTimeout(() => navigate(`/session?month=${month}`), 400);
  };

  const { data: transactions, loading, error } = useApi(
    async () => {
      if (range) {
        const months: string[] = [];
        let m = range.from;
        while (m <= range.to) {
          months.push(m);
          m = getNextMonth(m);
        }
        const results = await Promise.all(months.map(mo => api.getTransactions({ month: mo })));
        return results.flat();
      }
      return api.getTransactions({ month });
    },
    [month, range]
  );
  const { data: categories } = useApi(() => api.getCategories(), []);
  const { data: sessions } = useApi(() => api.getSessions(month), [month]);
  const lastSession = sessions && sessions.length > 0 ? sessions[0] : null;

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
    return <PageLoader />;
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
        <MonthSelector month={month} range={range} onChange={setMonth} onRangeChange={setRange} />
        <div className="flex border border-stone-100 rounded-lg overflow-hidden text-sm">
          <button
            className={cn(
              "px-4 py-2",
              mode === "overview"
                ? "bg-stone-700 text-white"
                : "bg-white text-stone-400"
            )}
            onClick={() => setMode("overview")}
          >
            Overview
          </button>
          <button
            className={cn(
              "px-4 py-2",
              mode === "detail"
                ? "bg-stone-700 text-white"
                : "bg-white text-stone-400"
            )}
            onClick={() => setMode("detail")}
          >
            Detail
          </button>
        </div>
      </div>

      <div className={cn(
        "transition-[filter,opacity] duration-[400ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
        isTransitioning && "blur-[8px] opacity-60"
      )}>
      {isEmpty ? (
        <EmptyState
          icon={<LayoutDashboard size={32} />}
          title="No transactions this month"
          description="Import a bank export to see your financial overview here."
          action={
            <Link
              to="/import"
              className="inline-flex px-4 py-2 text-sm bg-stone-700 text-white rounded-md hover:bg-stone-600"
            >
              Import transactions
            </Link>
          }
        />
      ) : mode === "overview" ? (
        <div key="overview" className="animate-fadeIn">
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
          onCategoryClick={() => setMode("detail")}
          onSwitchToDetail={() => { setMode("detail"); setOpenReflection(true); }}
          lastSession={lastSession}
          onReflect={handleStartSession}
        />
        </div>
      ) : (
        <div key="detail" className="animate-fadeIn">
        <DetailMode
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          netCashflow={netCashflow}
          savingsRate={savingsRate}
          chartData={chartData}
          month={month}
          range={range}
          lastSession={lastSession}
          initialReflectionOpen={openReflection}
          onReflect={handleStartSession}
          transactions={transactions || []}
          allCategories={categories || []}
        />
        </div>
      )}
      </div>
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
  onSwitchToDetail,
  lastSession,
  onReflect,
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
  onSwitchToDetail: () => void;
  lastSession?: { aiReflection: string; closingNote?: string; createdAt: string } | null;
  onReflect: () => void;
}) {
  const animatedValue = useCountUp(netCashflow, 1200);

  return (
    <div className="relative flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
      {/* Hero section */}
      <div className="text-center mb-12">
        <p className="text-lg text-stone-300 mb-4">
          {formatMonth(month)} balance
        </p>
        <button
          onClick={onSwitchToDetail}
          className="text-[6.5rem] font-light tracking-tight leading-none tabular-nums text-stone-900 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {formatCurrency(animatedValue)}
        </button>
        <div className="flex items-center justify-center gap-8 mt-6 text-base text-stone-400">
          <span>Income: <span className="font-medium text-stone-600">{formatCurrency(totalIncome)}</span></span>
          <span>Expenses: <span className="font-medium text-stone-600">{formatCurrency(totalExpenses)}</span></span>
          <span><span className="font-medium text-stone-600">{savingsRate}%</span> saved</span>
        </div>
        {!lastSession && <TemporalReflectionBlock from={month} to={month} variant="subtle" />}
      </div>

      {/* Category grid */}
      <div className="mb-8">
        <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
          {chartData.slice(0, 8).map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryClick(cat.id)}
              className="bg-white border border-stone-50 rounded-xl p-4 text-center hover:shadow-card hover:border-stone-200 transition-all"
            >
              <p className="text-sm text-stone-400 mb-1">{cat.name}</p>
              <p className="text-lg font-medium text-stone-700">{formatCurrency(cat.amount)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reflect link — anchored to bottom */}
      <div className="absolute bottom-6 left-0 right-0 text-center px-6">
        {lastSession ? (
          <div className="max-w-lg mx-auto">
            <button
              onClick={onSwitchToDetail}
              className="font-editorial text-sm text-stone-400 leading-relaxed hover:text-stone-600 transition-colors cursor-pointer line-clamp-2"
            >
              {lastSession.aiReflection.split("\n\n")[0]}
            </button>
            <div className="mt-2">
              <button
                onClick={onReflect}
                className="font-editorial text-sm text-stone-300 hover:text-stone-500 transition-colors"
              >
                Continue reflection &rarr;
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onReflect}
            className="font-editorial text-sm text-stone-300 hover:text-stone-500 transition-colors"
          >
            Reflect on this month &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

// --- Detail Mode (Vertical Scrollable Report) ---

function DetailMode({
  totalIncome,
  totalExpenses,
  netCashflow,
  savingsRate,
  chartData,
  month,
  range,
  lastSession,
  initialReflectionOpen,
  onReflect,
  transactions,
  allCategories,
}: {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;
  chartData: { name: string; amount: number; id: number }[];
  month: string;
  range?: MonthRange | null;
  lastSession?: { aiReflection: string; closingNote?: string; createdAt: string } | null;
  initialReflectionOpen?: boolean;
  onReflect: () => void;
  transactions: Transaction[];
  allCategories: Category[];
}) {
  const isSingleMonth = !range;
  const [reflectionOpen, setReflectionOpen] = useState(initialReflectionOpen || false);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-12">

      {/* 1. Reflection — interpretation layer */}
      {lastSession ? (
        <section>
          <button
            onClick={() => setReflectionOpen(!reflectionOpen)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-stone-700">{formatMonth(month)} reflection</h3>
              <span className="text-sm text-stone-400">{reflectionOpen ? "collapse" : "expand"}</span>
            </div>
            {!reflectionOpen && (
              <p className="font-editorial text-base text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                {lastSession.aiReflection.split("\n\n")[0]}
              </p>
            )}
          </button>
          {reflectionOpen && (
            <div className="mt-3 font-editorial text-base text-stone-500 leading-relaxed space-y-3">
              {lastSession.aiReflection.split("\n\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {lastSession.closingNote && (
                <p className="text-sm text-stone-400 mt-4 pt-3 border-t border-stone-100">
                  Note: {lastSession.closingNote}
                </p>
              )}
            </div>
          )}
          <button
            onClick={onReflect}
            className="text-sm text-stone-300 hover:text-stone-500 transition-colors mt-3"
          >
            Continue reflection &rarr;
          </button>
        </section>
      ) : (
        <section>
          <button
            onClick={onReflect}
            className="text-sm text-stone-300 hover:text-stone-500 transition-colors"
          >
            Reflect on this month &rarr;
          </button>
        </section>
      )}

      {/* 2. Metrics — headline numbers */}
      <FadeInSection>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Income" value={formatCurrency(totalIncome)} />
          <MetricCard label="Expenses" value={formatCurrency(totalExpenses)} />
          <MetricCard label="Net" value={formatCurrency(netCashflow)} />
          <MetricCard label="Saved" value={`${savingsRate}%`} />
        </div>
      </FadeInSection>

      {/* 3. Weekly pacing — rhythm (only for single month) */}
      {isSingleMonth && <FadeInSection><WeeklyPacingSection month={month} /></FadeInSection>}

      {/* 4. Categories — where the money went (expandable inline) */}
      <FadeInSection>
        <h3 className="text-sm font-medium text-stone-700 mb-4">Spending by category</h3>
        <div className="space-y-1">
          {chartData.map(cat => (
            <div key={cat.id}>
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                className={cn(
                  "w-full flex items-center justify-between py-3 px-4 rounded-lg transition-colors",
                  expandedCategory === cat.id ? "bg-stone-100/50" : "hover:bg-stone-100/50"
                )}
              >
                <span className="text-sm text-stone-600">{cat.name}</span>
                <span className="text-sm font-medium tabular-nums text-stone-900">{formatCurrency(cat.amount)}</span>
              </button>

              {/* Expanded content */}
              {expandedCategory === cat.id && (
                <CategoryDrillInline
                  categoryId={cat.id}
                  transactions={transactions}
                  allCategories={allCategories}
                />
              )}
            </div>
          ))}
        </div>
      </FadeInSection>

      {/* 5. Year trajectory — broader context */}
      <FadeInSection className="pb-12"><TrajectorySection year={parseInt(month.split("-")[0])} /></FadeInSection>
    </div>
  );
}

// --- Inline Category Drill Component ---

function CategoryDrillInline({ categoryId, transactions, allCategories }: {
  categoryId: number;
  transactions: Transaction[];
  allCategories: Category[];
}) {
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);

  const category = allCategories.find(c => c.id === categoryId);
  const isParent = category && !category.parentId;

  if (isParent) {
    // Show child categories with amounts
    const children = allCategories.filter(c => c.parentId === categoryId);
    const childTotals = children.map(child => {
      const total = transactions
        .filter(t => t.direction === "expense" && t.categoryId === child.id)
        .reduce((s, t) => s + t.amount, 0);
      return { id: child.id, name: child.name, amount: total };
    }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

    return (
      <div className="ml-4 pl-4 border-l border-stone-200 py-2 space-y-1">
        {childTotals.map(child => (
          <div key={child.id} className="flex items-center justify-between py-2 px-3 text-sm">
            <span className="text-stone-500">{child.name}</span>
            <span className="tabular-nums text-stone-700">{formatCurrency(child.amount)}</span>
          </div>
        ))}
        {childTotals.length === 0 && (
          <p className="text-sm text-stone-400 py-2 px-3">No sub-categories with spending</p>
        )}
      </div>
    );
  }

  // Child category — show merchants
  const merchantTotals = new Map<string, number>();
  transactions
    .filter(t => t.direction === "expense" && t.categoryId === categoryId)
    .forEach(t => {
      const name = t.merchantName || "Other";
      merchantTotals.set(name, (merchantTotals.get(name) || 0) + t.amount);
    });

  const merchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="ml-4 pl-4 border-l border-stone-200 py-2 space-y-1">
      {merchants.map(([name, amount]) => (
        <div key={name}>
          <button
            onClick={() => setExpandedMerchant(expandedMerchant === name ? null : name)}
            className="w-full flex items-center justify-between py-2 px-3 text-sm hover:bg-stone-50 rounded"
          >
            <span className="text-stone-500">{name}</span>
            <span className="tabular-nums text-stone-700">{formatCurrency(amount)}</span>
          </button>

          {/* Merchant expanded — show transactions */}
          {expandedMerchant === name && (
            <div className="ml-4 pl-4 border-l border-stone-100 py-1 space-y-1">
              {transactions
                .filter(t => t.direction === "expense" && t.categoryId === categoryId && (t.merchantName || "Other") === name)
                .map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 px-3 text-xs">
                    <span className="text-stone-400">{t.transactionDate}</span>
                    <span className="tabular-nums text-stone-500">{formatCurrency(t.amount)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      ))}
      {merchants.length === 0 && (
        <p className="text-sm text-stone-400 py-2 px-3">No transactions</p>
      )}
    </div>
  );
}
