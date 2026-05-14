import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { formatCurrency } from "../lib/utils";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Trajectory() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, loading } = useApi(() => api.getTrajectory(year), [year]);

  if (loading || !data) {
    return <div className="h-[calc(100vh-5rem)] flex items-center justify-center text-stone-400">Loading...</div>;
  }

  const { currentYear, previousYear, savings, totals } = data;

  // Build savings chart data (cumulative)
  let investGoalCum = 0;
  let savingsGoalCum = 0;
  const savingsChartData = savings.map((s: any, i: number) => {
    investGoalCum += s.investmentGoal;
    savingsGoalCum += s.savingsGoal;
    return {
      month: MONTH_LABELS[i],
      investActual: s.investmentCumulative,
      investGoal: investGoalCum,
      savingsActual: s.savingsCumulative,
      savingsGoal: savingsGoalCum,
    };
  });

  // Build spending chart data
  const spendingChartData = currentYear.map((c: any, i: number) => ({
    month: MONTH_LABELS[i],
    current: Math.round(c.expenses),
    previous: Math.round(previousYear[i]?.expenses || 0),
  }));

  // Progress percentages
  const investProgress = totals.investmentGoal > 0 ? Math.min(100, Math.round((totals.investmentActual / totals.investmentGoal) * 100)) : 0;
  const savingsProgress = totals.savingsGoal > 0 ? Math.min(100, Math.round((totals.savingsActual / totals.savingsGoal) * 100)) : 0;

  // Simple observation
  const totalCurrentSpending = currentYear.reduce((s: number, m: any) => s + m.expenses, 0);
  const monthsWithData = currentYear.filter((m: any) => m.expenses > 0).length;
  const avgSpending = monthsWithData > 0 ? Math.round(totalCurrentSpending / monthsWithData) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-2xl font-medium text-stone-900">Trajectory</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(year - 1)} className="p-1.5 hover:bg-stone-100 rounded-md">
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <span className="text-base font-medium text-stone-900 min-w-[48px] text-center">{year}</span>
          <button onClick={() => setYear(year + 1)} className="p-1.5 hover:bg-stone-100 rounded-md" disabled={year >= new Date().getFullYear()}>
            <ChevronRight size={18} className="text-stone-600" />
          </button>
        </div>
      </div>

      {/* Savings chart */}
      <div className="bg-white border border-stone-100 rounded-2xl p-8 shadow-card mb-8">
        <h2 className="text-base font-medium text-stone-700 mb-6">Savings & Investment</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={savingsChartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Line type="monotone" dataKey="investGoal" stroke="#d6d3d1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Investment goal" />
            <Line type="monotone" dataKey="investActual" stroke="#57534e" strokeWidth={2} dot={false} name="Investment actual" />
            <Line type="monotone" dataKey="savingsGoal" stroke="#d6d3d1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Savings goal" />
            <Line type="monotone" dataKey="savingsActual" stroke="#78716c" strokeWidth={2} dot={false} name="Savings actual" />
          </LineChart>
        </ResponsiveContainer>

        {/* Progress bars */}
        <div className="mt-6 space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-stone-600">Investment</span>
              <span className="text-stone-500">{formatCurrency(totals.investmentActual)} / {formatCurrency(totals.investmentGoal)}</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-stone-700 rounded-full" style={{ width: `${investProgress}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-stone-600">Savings</span>
              <span className="text-stone-500">{formatCurrency(totals.savingsActual)} / {formatCurrency(totals.savingsGoal)}</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-stone-500 rounded-full" style={{ width: `${savingsProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Observation */}
      <div className="text-center mb-12 py-4">
        <p className="text-sm text-stone-400 mb-1">This year so far</p>
        <p className="font-editorial text-lg text-stone-600 italic max-w-md mx-auto leading-relaxed">
          {monthsWithData > 0
            ? `Average monthly spending: ${formatCurrency(avgSpending)}. ${investProgress >= 80 ? "Investment on track." : "Investment building."} ${savingsProgress >= 80 ? "Savings target nearly reached." : "Savings progressing steadily."}`
            : "Not enough data yet for observations."}
        </p>
      </div>

      {/* Monthly spending chart */}
      <div className="bg-white border border-stone-100 rounded-2xl p-8 shadow-card">
        <h2 className="text-base font-medium text-stone-700 mb-6">Monthly Spending</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={spendingChartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="previous" fill="#e7e5e4" radius={[4, 4, 0, 0]} name={`${year - 1}`} />
            <Bar dataKey="current" fill="#57534e" radius={[4, 4, 0, 0]} name={`${year}`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
