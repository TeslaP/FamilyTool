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

  // Fetch last 3 months of transactions relative to selectedMonth
  const month1 = getPreviousMonth(selectedMonth);
  const month2 = getPreviousMonth(month1);
  const month3 = getPreviousMonth(month2);

  const { data: tx1 } = useApi(() => api.getTransactions({ month: month1 }), [selectedMonth]);
  const { data: tx2 } = useApi(() => api.getTransactions({ month: month2 }), [selectedMonth]);
  const { data: tx3 } = useApi(() => api.getTransactions({ month: month3 }), [selectedMonth]);
  const { data: categories } = useApi(() => api.getCategories(), []);
  const { data: savedBudgets } = useApi(() => api.getBudgets(selectedMonth), [selectedMonth]);

  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const allTransactions = useMemo(() => [...(tx1 || []), ...(tx2 || []), ...(tx3 || [])], [tx1, tx2, tx3]);

  const categoryMap = useMemo(() => new Map(categories?.map(c => [c.id, c]) || []), [categories]);

  // Calculate fixed costs (recurring transactions)
  const fixedCosts = useMemo(() => {
    if (!tx1) return [];
    const recurring = tx1.filter(t => t.isRecurring && t.direction === "expense" && t.categoryId);
    const grouped = new Map<number, { name: string; amount: number }>();
    recurring.forEach(t => {
      const cat = categoryMap.get(t.categoryId!);
      const key = t.categoryId!;
      const existing = grouped.get(key);
      if (existing) {
        existing.amount += t.amount;
      } else {
        grouped.set(key, { name: cat?.name || "Unknown", amount: t.amount });
      }
    });
    return Array.from(grouped.entries()).map(([id, { name, amount }]) => {
      const savedAmount = savedBudgets?.find(b => b.categoryId === id)?.budgetAmount;
      return {
        id, key: `fixed-${id}`, name, amount: Math.round(savedAmount ?? amount), type: "fixed" as const,
      };
    });
  }, [tx1, categoryMap, savedBudgets]);

  // Calculate variable costs (3-month average per category, excluding recurring)
  const variableCosts = useMemo(() => {
    const nonRecurring = allTransactions.filter(t => !t.isRecurring && t.direction === "expense" && t.categoryId);
    const grouped = new Map<number, number[]>();
    nonRecurring.forEach(t => {
      const arr = grouped.get(t.categoryId!) || [];
      arr.push(t.amount);
      grouped.set(t.categoryId!, arr);
    });

    // Count how many months we have data for
    const monthCount = [tx1, tx2, tx3].filter(t => t && t.length > 0).length || 1;

    return Array.from(grouped.entries()).map(([id, amounts]) => {
      const total = amounts.reduce((s, a) => s + a, 0);
      const avg = Math.round(total / monthCount);
      const cat = categoryMap.get(id);
      const savedAmount = savedBudgets?.find(b => b.categoryId === id)?.budgetAmount;
      return { id, key: `variable-${id}`, name: cat?.name || "Unknown", amount: Math.round(savedAmount ?? avg), type: "variable" as const };
    }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [allTransactions, categoryMap, tx1, tx2, tx3, savedBudgets]);

  // Projected income (average of last 3 months)
  const projectedIncome = useMemo(() => {
    const incomeTransactions = allTransactions.filter(t => t.direction === "income");
    const monthCount = [tx1, tx2, tx3].filter(t => t && t.length > 0).length || 1;
    const total = incomeTransactions.reduce((s, t) => s + t.amount, 0);
    return Math.round(total / monthCount);
  }, [allTransactions, tx1, tx2, tx3]);

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
        budgetAmount: getValue(item.key, item.amount),
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
  const totalVariable = variableCosts.reduce((s, c) => s + getValue(c.key, c.amount), 0) * monthsInPeriod;
  const projectedIncomeTotal = projectedIncome * monthsInPeriod;
  const remaining = projectedIncomeTotal - totalFixed - totalVariable;

  const loading = !tx1 || !categories;

  if (loading) return <div className="p-6 text-stone-500">Loading...</div>;

  // Empty state
  if (allTransactions.length === 0) {
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
          {formatCurrency(remaining)}
        </p>
        <p className="text-xs text-stone-400 mt-1">
          {formatCurrency(projectedIncomeTotal)} income − {formatCurrency(totalFixed)} fixed − {formatCurrency(totalVariable)} variable
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
            <h3 className="text-base font-medium text-stone-600">Variable costs (avg)</h3>
            <span className="text-sm font-semibold text-stone-900">{formatCurrency(totalVariable)}</span>
          </div>
          <div className="space-y-2">
            {variableCosts.slice(0, 10).map(item => (
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
            {variableCosts.length === 0 && <p className="text-xs text-stone-400">No variable spending data</p>}
          </div>
        </div>

        {/* Savings & summary */}
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
            <div className="flex justify-between">
              <span className="text-stone-600">Variable costs</span>
              <span className="font-medium text-stone-900">−{formatCurrency(totalVariable)}</span>
            </div>
            <div className="border-t border-stone-100 pt-2 flex justify-between">
              <span className="font-medium text-stone-600">Projected surplus</span>
              <span className="font-bold text-stone-900">
                {formatCurrency(remaining)}
              </span>
            </div>
            <div className="border-t border-stone-100 pt-2 text-xs text-stone-400">
              Based on {[tx1, tx2, tx3].filter(t => t && t.length > 0).length} months of data
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
