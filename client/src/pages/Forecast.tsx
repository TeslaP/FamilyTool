import { useState, useMemo } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { formatCurrency, getCurrentMonth, getNextMonth, getPreviousMonth, cn } from "../lib/utils";

export function Forecast() {
  const currentMonth = getCurrentMonth();
  const forecastMonth = getNextMonth(currentMonth);

  // Fetch last 3 months of transactions
  const month1 = currentMonth;
  const month2 = getPreviousMonth(month1);
  const month3 = getPreviousMonth(month2);

  const { data: tx1 } = useApi(() => api.getTransactions({ month: month1 }), []);
  const { data: tx2 } = useApi(() => api.getTransactions({ month: month2 }), []);
  const { data: tx3 } = useApi(() => api.getTransactions({ month: month3 }), []);
  const { data: categories } = useApi(() => api.getCategories(), []);

  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

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
    return Array.from(grouped.entries()).map(([id, { name, amount }]) => ({
      id, key: `fixed-${id}`, name, amount: Math.round(amount), type: "fixed" as const,
    }));
  }, [tx1, categoryMap]);

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
      return { id, key: `variable-${id}`, name: cat?.name || "Unknown", amount: avg, type: "variable" as const };
    }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [allTransactions, categoryMap, tx1, tx2, tx3]);

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

  // Calculate totals
  const totalFixed = fixedCosts.reduce((s, c) => s + getValue(c.key, c.amount), 0);
  const totalVariable = variableCosts.reduce((s, c) => s + getValue(c.key, c.amount), 0);
  const remaining = projectedIncome - totalFixed - totalVariable;

  const loading = !tx1 || !categories;

  if (loading) return <div className="p-6 text-stone-500">Loading...</div>;

  // Empty state
  if (allTransactions.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-stone-900 mb-4">Forecast</h2>
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <h3 className="text-sm font-medium text-stone-900">Not enough data</h3>
          <p className="text-sm text-stone-500 mt-1">Import at least one month of transactions to see forecasts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-stone-900 mb-6">
        Forecast — {new Date(parseInt(forecastMonth.split("-")[0]), parseInt(forecastMonth.split("-")[1]) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </h2>

      {/* Hero remaining metric */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 text-center mb-6">
        <p className="text-sm text-stone-500 font-normal">Remaining after fixed costs</p>
        <p className={cn("text-4xl font-light mt-1", remaining >= 0 ? "text-stone-900" : "text-red-600")}>
          {formatCurrency(remaining)}
        </p>
        <p className="text-xs text-stone-400 mt-1">
          {formatCurrency(projectedIncome)} income − {formatCurrency(totalFixed)} fixed − {formatCurrency(totalVariable)} variable
        </p>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-3 gap-4">
        {/* Fixed costs */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-700">Fixed costs</h3>
            <span className="text-sm font-semibold text-stone-900">{formatCurrency(totalFixed)}</span>
          </div>
          <div className="space-y-2">
            {fixedCosts.map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{item.name}</span>
                <input
                  type="number"
                  value={getValue(item.key, item.amount)}
                  onChange={(e) => setOverride(item.key, Number(e.target.value) || 0)}
                  className="w-20 text-right text-sm border border-stone-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            ))}
            {fixedCosts.length === 0 && <p className="text-xs text-stone-400">No recurring costs detected</p>}
          </div>
        </div>

        {/* Variable costs */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-700">Variable costs (avg)</h3>
            <span className="text-sm font-semibold text-stone-900">{formatCurrency(totalVariable)}</span>
          </div>
          <div className="space-y-2">
            {variableCosts.slice(0, 10).map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{item.name}</span>
                <input
                  type="number"
                  value={getValue(item.key, item.amount)}
                  onChange={(e) => setOverride(item.key, Number(e.target.value) || 0)}
                  className="w-20 text-right text-sm border border-stone-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            ))}
            {variableCosts.length === 0 && <p className="text-xs text-stone-400">No variable spending data</p>}
          </div>
        </div>

        {/* Savings & summary */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-stone-700">Summary</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Projected income</span>
              <span className="font-medium text-stone-900">{formatCurrency(projectedIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Fixed costs</span>
              <span className="font-medium text-stone-900">−{formatCurrency(totalFixed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Variable costs</span>
              <span className="font-medium text-stone-900">−{formatCurrency(totalVariable)}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between">
              <span className="font-medium text-stone-700">Projected surplus</span>
              <span className={cn("font-bold", remaining >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(remaining)}
              </span>
            </div>
            <div className="border-t border-stone-100 pt-2 text-xs text-stone-400">
              Based on {[tx1, tx2, tx3].filter(t => t && t.length > 0).length} months of data
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
