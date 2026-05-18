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

// --- Weekly Pacing Section (fetches its own data) ---

function WeeklyPacingSection({ month }: { month: string }) {
  const { data, loading } = useApi(() => api.getPacing(month), [month]);

  if (loading || !data) return <div className="text-stone-400 text-sm">Loading weekly data...</div>;

  const { weeks, projection } = data;
  const trendColor = projection.trend === "tightening" ? "text-amber-600" :
                     projection.trend === "improving" ? "text-green-700" : "text-stone-500";

  return (
    <section>
      <h3 className="text-base font-medium text-stone-700 mb-4">Weekly pacing</h3>
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
      <p className="text-xs text-stone-400">
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
      <h3 className="text-base font-medium text-stone-700 mb-4">Year trajectory &mdash; {year}</h3>

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
          onCategoryClick={(id) => navigate(`/drilldown?month=${month}&category=${id}`)}
          onSwitchToDetail={() => setMode("detail")}
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
          topMerchants={topMerchants}
          summary={summary}
          summaryLoading={summaryLoading}
          onGenerateSummary={handleGenerateSummary}
          month={month}
          range={range}
          onCategoryClick={(id) => navigate(`/drilldown?month=${month}&category=${id}`)}
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
        <TemporalReflectionBlock from={month} to={month} variant="subtle" />
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
        {summary ? (
          <p className="font-editorial text-base text-stone-500 italic max-w-lg mx-auto leading-relaxed">{summary}</p>
        ) : lastSession ? (
          <div className="max-w-lg mx-auto">
            <p className="font-editorial text-sm text-stone-400 italic leading-relaxed line-clamp-2">
              {lastSession.aiReflection.split("\n\n")[0]}
            </p>
            <button
              onClick={onReflect}
              className="inline-block mt-2 font-editorial text-base text-stone-300 italic hover:text-stone-500 transition-colors"
            >
              Continue reflection &rarr;
            </button>
          </div>
        ) : (
          <button
            onClick={onReflect}
            className="font-editorial text-base text-stone-300 italic hover:text-stone-500 transition-colors"
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
  topMerchants,
  summary,
  summaryLoading,
  onGenerateSummary,
  month,
  range,
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
  range?: MonthRange | null;
  onCategoryClick: (id: number) => void;
}) {
  const isSingleMonth = !range;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-12">

      {/* Section 1: Monthly metrics (always shown) */}
      <FadeInSection>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Income" value={formatCurrency(totalIncome)} />
          <MetricCard label="Expenses" value={formatCurrency(totalExpenses)} />
          <MetricCard label="Net" value={formatCurrency(netCashflow)} />
          <MetricCard label="Saved" value={`${savingsRate}%`} />
        </div>
      </FadeInSection>

      {/* Temporal Reflection */}
      <FadeInSection>
        <TemporalReflectionBlock from={range?.from || month} to={range?.to || month} variant="prominent" />
      </FadeInSection>

      {/* Section 2: Weekly Pacing (only for single month) */}
      {isSingleMonth && <FadeInSection><WeeklyPacingSection month={month} /></FadeInSection>}

      {/* Section 3: Category Breakdown */}
      <FadeInSection>
        <h3 className="text-base font-medium text-stone-700 mb-4">Spending by category</h3>
        <div className="grid grid-cols-4 gap-4">
          {chartData.map(cat => (
            <button key={cat.id} onClick={() => onCategoryClick(cat.id)} className="bg-white border border-stone-50 rounded-xl p-4 text-center hover:shadow-card transition-all">
              <p className="text-sm text-stone-400 mb-1">{cat.name}</p>
              <p className="text-lg font-medium text-stone-700">{formatCurrency(cat.amount)}</p>
            </button>
          ))}
        </div>
      </FadeInSection>

      {/* Section 4: Top Merchants */}
      {topMerchants.length > 0 && (
        <FadeInSection>
          <h3 className="text-base font-medium text-stone-700 mb-4">Top merchants</h3>
          <div className="bg-white border border-stone-100 rounded-xl divide-y divide-stone-50">
            {topMerchants.map(([name, amount]) => (
              <div key={name} className="flex justify-between px-5 py-3">
                <span className="text-sm text-stone-700">{name}</span>
                <span className="text-sm font-medium text-stone-900">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </FadeInSection>
      )}

      {/* Section 5: Year Trajectory (always shown) */}
      <FadeInSection><TrajectorySection year={parseInt(month.split("-")[0])} /></FadeInSection>

      {/* Section 6: Observations */}
      <FadeInSection className="pb-12">
        <h3 className="text-base font-medium text-stone-700 mb-4">Observations</h3>
        {summary ? (
          <p className="font-editorial text-lg text-stone-600 italic leading-relaxed">{summary}</p>
        ) : (
          <button onClick={onGenerateSummary} disabled={summaryLoading} className="font-editorial text-base text-stone-400 italic hover:text-stone-600 transition-colors">
            {summaryLoading ? "Reflecting..." : "Reflect on this period →"}
          </button>
        )}
      </FadeInSection>
    </div>
  );
}
