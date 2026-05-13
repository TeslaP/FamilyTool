import { useState } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { MonthSelector } from "../components/MonthSelector";
import { CategoryDropdown } from "../components/CategoryDropdown";
import { formatCurrency, getCurrentMonth, cn } from "../lib/utils";
import { CheckSquare, Bookmark } from "lucide-react";
import type { Transaction } from "../types";

export function Review() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingMerchant, setEditingMerchant] = useState<number | null>(null);
  const [merchantValue, setMerchantValue] = useState("");
  const [bulkCategory, setBulkCategory] = useState<number | null>(null);

  const { data: transactions, loading, refetch } = useApi(
    () => api.getTransactions({ month, needsReview: true }),
    [month]
  );
  const { data: categories } = useApi(() => api.getCategories(), []);

  const handleCategoryChange = async (txId: number, categoryId: number) => {
    await api.updateTransaction(txId, { categoryId });
    refetch();
  };

  const handleMerchantSave = async (txId: number) => {
    if (merchantValue.trim()) {
      await api.updateTransaction(txId, { merchantName: merchantValue.trim() });
    }
    setEditingMerchant(null);
    refetch();
  };

  const handleCreateRule = async (tx: Transaction) => {
    if (!tx.merchantName || !tx.categoryId) return;
    await api.createRule(tx.id, { matchType: "contains", matchValue: tx.merchantName });
  };

  const handleBulkAssign = async () => {
    if (!bulkCategory || selected.size === 0) return;
    for (const id of selected) {
      await api.updateTransaction(id, { categoryId: bulkCategory });
    }
    setSelected(new Set());
    setBulkCategory(null);
    refetch();
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (!transactions) return;
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  };

  if (loading) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-stone-900">Review</h2>
          {transactions && (
            <span className="text-sm text-stone-500">({transactions.length} items)</span>
          )}
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && categories && (
        <div className="mb-4 p-3 bg-white border border-stone-200 rounded-lg flex items-center gap-3">
          <span className="text-sm text-stone-600">{selected.size} selected</span>
          <CategoryDropdown
            categories={categories}
            value={bulkCategory}
            onChange={setBulkCategory}
            className="w-48"
          />
          <button
            onClick={handleBulkAssign}
            disabled={!bulkCategory}
            className="px-3 py-1 text-sm bg-stone-900 text-white rounded-md disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      )}

      {/* Empty state */}
      {transactions && transactions.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <CheckSquare className="mx-auto mb-3 text-green-500" size={32} />
          <h3 className="text-sm font-medium text-stone-900">All caught up!</h3>
          <p className="text-sm text-stone-500 mt-1">No transactions need review this month.</p>
        </div>
      )}

      {/* Table */}
      {transactions && transactions.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="w-8 p-3">
                  <input
                    type="checkbox"
                    onChange={toggleAll}
                    checked={selected.size === transactions.length && transactions.length > 0}
                  />
                </th>
                <th className="text-left p-3 font-medium text-stone-500">Date</th>
                <th className="text-left p-3 font-medium text-stone-500">Description</th>
                <th className="text-right p-3 font-medium text-stone-500">Amount</th>
                <th className="text-left p-3 font-medium text-stone-500 w-44">Category</th>
                <th className="text-left p-3 font-medium text-stone-500 w-36">Merchant</th>
                <th className="text-center p-3 font-medium text-stone-500 w-16">Conf</th>
                <th className="text-left p-3 font-medium text-stone-500 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={cn(
                    "border-b border-stone-100",
                    !tx.categoryId && "bg-amber-50"
                  )}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                    />
                  </td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">
                    {tx.transactionDate}
                  </td>
                  <td
                    className="p-3 text-stone-900 truncate max-w-[200px]"
                    title={tx.rawDescription}
                  >
                    {tx.rawDescription}
                  </td>
                  <td className="p-3 text-right text-stone-900 whitespace-nowrap">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-3">
                    {categories && (
                      <CategoryDropdown
                        categories={categories}
                        value={tx.categoryId}
                        onChange={(catId) => handleCategoryChange(tx.id, catId)}
                        className="w-full"
                      />
                    )}
                  </td>
                  <td className="p-3">
                    {editingMerchant === tx.id ? (
                      <input
                        autoFocus
                        value={merchantValue}
                        onChange={(e) => setMerchantValue(e.target.value)}
                        onBlur={() => handleMerchantSave(tx.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleMerchantSave(tx.id)}
                        className="w-full text-sm border border-stone-200 rounded px-2 py-1"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingMerchant(tx.id);
                          setMerchantValue(tx.merchantName || "");
                        }}
                        className="cursor-pointer text-stone-700 hover:text-stone-900"
                      >
                        {tx.merchantName || (
                          <span className="text-stone-400 italic">edit</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={cn(
                        "text-xs",
                        tx.confidence >= 0.7 ? "text-stone-400" : "text-amber-600"
                      )}
                    >
                      {(tx.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-3">
                    {tx.merchantName && tx.categoryId && (
                      <button
                        onClick={() => handleCreateRule(tx)}
                        title="Save as rule"
                        className="text-stone-400 hover:text-stone-700"
                      >
                        <Bookmark size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
