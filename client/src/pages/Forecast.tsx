import { useState, useMemo, useCallback } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useMonthParam } from "../hooks/useMonthParam";
import { formatCurrency, getCurrentMonth, getNextMonth, getPreviousMonth, cn } from "../lib/utils";
import { MonthSelector } from "../components/MonthSelector";

function formatCurrencyWhole(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

export function Forecast() {
  const { month: selectedMonth, range, setMonth: setSelectedMonth, setRange } = useMonthParam(getNextMonth(getCurrentMonth()));

  // Fetch last 12 months of transactions for averaging
  const historicalMonths = useMemo(() => {
    const months: string[] = [];
    let m = getPreviousMonth(selectedMonth);
    for (let i = 0; i < 12; i++) {
      months.push(m);
      m = getPreviousMonth(m);
    }
    return months;
  }, [selectedMonth]);

  const { data: allHistoricalTx } = useApi(async () => {
    const results = await Promise.all(historicalMonths.map(m => api.getTransactions({ month: m })));
    return results.flat();
  }, [selectedMonth]);

  // Most recent month (for fixed costs reference)
  const recentMonth = historicalMonths[0];
  const { data: recentTx } = useApi(() => api.getTransactions({ month: recentMonth }), [recentMonth]);

  const { data: categories } = useApi(() => api.getCategories(), []);
  const { data: savedBudgets } = useApi(() => api.getBudgets(selectedMonth), [selectedMonth]);

  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const categoryMap = useMemo(() => new Map(categories?.map(c => [c.id, c]) || []), [categories]);

  // Calculate fixed costs (categories marked as fixed)
  const fixedCosts = useMemo(() => {
    if (!recentTx || !categories) return [];

    const fixedCategories = categories.filter(c => c.isFixed && c.parentId);

    return fixedCategories.map(cat => {
      const total = recentTx
        .filter(t => t.direction === "expense" && t.categoryId === cat.id)
        .reduce((s, t) => s + t.amount, 0);

      const savedAmount = savedBudgets?.find(b => b.categoryId === cat.id)?.budgetAmount;
      return {
        id: cat.id, key: `fixed-${cat.id}`, name: cat.name, amount: Math.round(savedAmount ?? total), type: "fixed" as const,
      };
    }).filter(c => c.amount > 0 || savedBudgets?.find(b => b.categoryId === c.id));
  }, [recentTx, categories, savedBudgets]);

  // Calculate variable costs — 12-month average with outlier trimming (95% rule)
  const variableCosts = useMemo(() => {
    if (!allHistoricalTx || !categories) return [];

    // Get ALL leaf expense categories (not fixed)
    const fixedCatIds = new Set(fixedCosts.map(f => f.id));
    const allExpenseCategories = categories
      .filter(c => c.parentId && c.type === "expense" && c.isActive && !c.isFixed)
      .filter(cat => !fixedCatIds.has(cat.id));

    // Group transactions by month per category
    return allExpenseCategories.map(cat => {
      // Get monthly totals for this category
      const monthlyTotals = new Map<string, number>();
      allHistoricalTx
        .filter(t => t.direction === "expense" && t.categoryId === cat.id)
        .forEach(t => {
          const m = t.transactionDate.slice(0, 7);
          monthlyTotals.set(m, (monthlyTotals.get(m) || 0) + t.amount);
        });

      const values = Array.from(monthlyTotals.values()).sort((a, b) => a - b);

      let avg = 0;
      if (values.length >= 4) {
        // Trim top and bottom (95% rule — remove highest and lowest)
        const trimmed = values.slice(1, -1);
        avg = Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
      } else if (values.length > 0) {
        // Not enough data to trim — simple average
        avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
      }

      const savedAmount = savedBudgets?.find(b => b.categoryId === cat.id)?.budgetAmount;
      return {
        id: cat.id,
        key: `variable-${cat.id}`,
        name: cat.name,
        avg,
        amount: Math.round(savedAmount ?? 0),
        type: "variable" as const,
      };
    }).sort((a, b) => b.avg - a.avg);
  }, [allHistoricalTx, categories, savedBudgets, fixedCosts]);

  // Projected income (12-month average with trimming)
  const projectedIncome = useMemo(() => {
    if (!allHistoricalTx) return 0;
    const monthlyIncome = new Map<string, number>();
    allHistoricalTx
      .filter(t => t.direction === "income")
      .forEach(t => {
        const m = t.transactionDate.slice(0, 7);
        monthlyIncome.set(m, (monthlyIncome.get(m) || 0) + t.amount);
      });
    const values = Array.from(monthlyIncome.values()).sort((a, b) => a - b);
    if (values.length >= 4) {
      const trimmed = values.slice(1, -1);
      return Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
    }
    if (values.length > 0) return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    return 0;
  }, [allHistoricalTx]);

  // Get value (with override support)
  const getValue = (key: string, defaultAmount: number) => {
    return overrides.has(key) ? overrides.get(key)! : defaultAmount;
  };

  const setOverride = (key: string, value: number) => {
    const next = new Map(overrides);
    next.set(key, value);
    setOverrides(next);
  };

  // Save budgets
  const handleSave = useCallback(async () => {
    const allBudgets = [
      ...fixedCosts.map(item => ({
        categoryId: item.id,
        budgetAmount: getValue(item.key, item.amount),
        isFixed: true,
      })),
      ...variableCosts.map(item => ({
        categoryId: item.id,
        budgetAmount: getValue(item.key, 0),
        isFixed: false,
      })),
    ];
    try {
      setSaveStatus("saving");
      await api.saveBudgets(selectedMonth, allBudgets);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedCosts, variableCosts, overrides, selectedMonth]);

  // Count months in the active period
  const monthsInPeriod = range
    ? (() => {
        let count = 0;
        let m = range.from;
        while (m <= range.to) { count++; m = getNextMonth(m); }
        return count;
      })()
    : 1;

  // Calculate totals (multiplied by period length)
  const totalFixed = fixedCosts.reduce((s, c) => s + getValue(c.key, c.amount), 0) * monthsInPeriod;
  const totalVariableAvg = variableCosts.reduce((s, c) => s + c.avg, 0);
  const totalVariableBudget = variableCosts.reduce((s, c) => s + getValue(c.key, 0), 0);
  const projectedIncomeTotal = projectedIncome * monthsInPeriod;
  const remainingFromAvg = projectedIncomeTotal - totalFixed - totalVariableAvg * monthsInPeriod;
  const remainingFromBudget = projectedIncomeTotal - totalFixed - totalVariableBudget * monthsInPeriod;

  const loading = !recentTx || !categories;

  if (loading) return <div className="p-6 text-stone-500">Loading...</div>;

  // Empty state
  if (!allHistoricalTx || allHistoricalTx.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-medium text-stone-900 mb-4">Forecast</h2>
        <div className="bg-white border border-stone-100 rounded-lg p-12 text-center">
          <h3 className="text-sm font-medium text-stone-900">Not enough data</h3>
          <p className="text-sm text-stone-500 mt-1">Import at least one month of transactions to see forecasts.</p>
        </div>
      </div>
    );
  }

  const isMultiMonth = monthsInPeriod > 1;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-medium text-stone-900">Forecast</h2>
        <MonthSelector month={selectedMonth} range={range} onChange={setSelectedMonth} onRangeChange={setRange} />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => setRange(null)}
          className={cn("px-3 py-1 text-sm rounded-md", !range ? "bg-stone-700 text-white" : "text-stone-500 hover:bg-stone-100")}
        >
          1 month
        </button>
        <button
          onClick={() => setRange({ from: selectedMonth, to: getNextMonth(getNextMonth(selectedMonth)), label: "3 months" })}
          className={cn("px-3 py-1 text-sm rounded-md", range?.label === "3 months" ? "bg-stone-700 text-white" : "text-stone-500 hover:bg-stone-100")}
        >
          3 months
        </button>
        <button
          onClick={() => {
            const eoy = `${selectedMonth.split("-")[0]}-12`;
            setRange({ from: selectedMonth, to: eoy, label: "Till end of year" });
          }}
          className={cn("px-3 py-1 text-sm rounded-md", range?.label === "Till end of year" ? "bg-stone-700 text-white" : "text-stone-500 hover:bg-stone-100")}
        >
          Till EOY
        </button>
      </div>

      {/* Hero remaining metric */}
      <div className="bg-white border border-stone-100 rounded-lg p-6 text-center mb-6">
        <p className="text-sm text-stone-400 font-normal">
          Remaining after fixed costs{monthsInPeriod > 1 ? ` (${monthsInPeriod} months)` : ""}
        </p>
        <p className="text-4xl font-light mt-1 tabular-nums text-stone-900">
          {formatCurrency(projectedIncomeTotal - totalFixed)}
        </p>
        <p className="text-xs text-stone-400 mt-1">
          {formatCurrency(projectedIncomeTotal)} income − {formatCurrency(totalFixed)} fixed
        </p>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-3 gap-4">
        {/* Fixed costs */}
        <div className="bg-white border border-stone-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-600">Fixed costs</h3>
            <span className="text-sm font-semibold text-stone-900">{formatCurrency(totalFixed)}</span>
          </div>
          <div className="space-y-2">
            {fixedCosts.map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{item.name}</span>
                {isMultiMonth ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-stone-400">Projected</span>
                      <p className="text-sm tabular-nums text-stone-700">{formatCurrencyWhole(getValue(item.key, item.amount) * monthsInPeriod)}</p>
                    </div>
                    {savedBudgets?.find(b => b.categoryId === item.id) && (
                      <div className="text-right">
                        <span className="text-xs text-stone-400">Target</span>
                        <p className="text-sm tabular-nums text-stone-700">{formatCurrencyWhole(savedBudgets.find(b => b.categoryId === item.id)!.budgetAmount * monthsInPeriod)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="number"
                    value={getValue(item.key, item.amount)}
                    onChange={(e) => setOverride(item.key, Number(e.target.value) || 0)}
                    onBlur={handleSave}
                    className="w-20 text-right text-sm tabular-nums border border-stone-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                )}
              </div>
            ))}
            {fixedCosts.length === 0 && <p className="text-xs text-stone-400">No recurring costs detected</p>}
          </div>
        </div>

        {/* Variable costs */}
        <div className="bg-white border border-stone-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-600">Variable costs</h3>
            <span className="text-sm text-stone-400">avg: {formatCurrencyWhole(totalVariableAvg)}</span>
          </div>
          <div className="space-y-2">
            {variableCosts.slice(0, 10).map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{item.name}</span>
                {isMultiMonth ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-stone-400">{formatCurrencyWhole(item.avg * monthsInPeriod)}</span>
                    {getValue(item.key, 0) > 0 && (
                      <span className="text-sm tabular-nums text-stone-700">{formatCurrencyWhole(getValue(item.key, 0) * monthsInPeriod)}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-stone-400 w-16 text-right">{formatCurrencyWhole(item.avg)}</span>
                    <input
                      type="number"
                      value={getValue(item.key, 0)}
                      onChange={(e) => setOverride(item.key, Number(e.target.value) || 0)}
                      onBlur={handleSave}
                      placeholder="0"
                      className="w-20 text-right text-sm tabular-nums border border-stone-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-900 placeholder:text-stone-300"
                    />
                  </div>
                )}
              </div>
            ))}
            {variableCosts.length === 0 && <p className="text-xs text-stone-400">No variable spending data</p>}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white border border-stone-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-600">Summary</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Projected income</span>
              <span className="font-medium text-stone-900">{formatCurrency(projectedIncomeTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Fixed costs</span>
              <span className="font-medium text-stone-900">−{formatCurrency(totalFixed)}</span>
            </div>
            <div className="border-t border-stone-100 pt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Based on average</span>
                <span className="tabular-nums text-stone-600">{formatCurrency(projectedIncomeTotal - totalFixed - totalVariableAvg * monthsInPeriod)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Based on your budget</span>
                <span className="font-bold tabular-nums text-stone-900">{formatCurrency(projectedIncomeTotal - totalFixed - totalVariableBudget * monthsInPeriod)}</span>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-2 text-xs text-stone-400">
              Based on 12-month average (outliers excluded)
            </div>
          </div>
        </div>

        {/* Save button (single month only) */}
        {!isMultiMonth && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors"
            >
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save budget"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
