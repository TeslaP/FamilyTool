import { useSearchParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Breadcrumb } from "../components/Breadcrumb";
import { formatCurrency, getCurrentMonth } from "../lib/utils";

export function DashboardDrilldown() {
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") || getCurrentMonth();
  const categoryId = searchParams.get("category")
    ? Number(searchParams.get("category"))
    : null;
  const merchant = searchParams.get("merchant");

  const { data: transactions, loading } = useApi(
    () => api.getTransactions({ month }),
    [month]
  );
  const { data: categories } = useApi(() => api.getCategories(), []);

  if (loading || !transactions || !categories) {
    return <div className="p-6 text-stone-500">Loading...</div>;
  }

  // Find current category info
  const currentCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;
  const parentCategory = currentCategory?.parentId
    ? categories.find((c) => c.id === currentCategory.parentId)
    : null;
  const isParent = currentCategory && !currentCategory.parentId;
  const childCategories = isParent
    ? categories.filter((c) => c.parentId === categoryId)
    : [];

  // Build breadcrumbs
  const crumbs: { label: string; to?: string }[] = [
    { label: "Dashboard", to: "/" },
  ];
  if (parentCategory) {
    crumbs.push({
      label: parentCategory.name,
      to: `/drilldown?month=${month}&category=${parentCategory.id}`,
    });
  }
  if (currentCategory) {
    if (merchant) {
      crumbs.push({
        label: currentCategory.name,
        to: `/drilldown?month=${month}&category=${categoryId}`,
      });
      crumbs.push({ label: merchant });
    } else {
      crumbs.push({ label: currentCategory.name });
    }
  }

  // Filter transactions to expenses
  const filtered = transactions.filter((t) => t.direction === "expense");

  // Merchant + category: show individual transactions
  if (merchant && categoryId) {
    const merchantTransactions = filtered.filter(
      (t) => t.merchantName === merchant && t.categoryId === categoryId
    );

    return (
      <div className="p-6 bg-stone-50 min-h-full">
        <Breadcrumb crumbs={crumbs} />
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {merchant}
        </h2>
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left p-3 font-medium text-stone-500">
                  Date
                </th>
                <th className="text-left p-3 font-medium text-stone-500">
                  Description
                </th>
                <th className="text-right p-3 font-medium text-stone-500">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {merchantTransactions.map((t) => (
                <tr key={t.id} className="border-b border-stone-100">
                  <td className="p-3 text-stone-600">{t.transactionDate}</td>
                  <td className="p-3 text-stone-900">{t.rawDescription}</td>
                  <td className="p-3 text-right text-stone-900">
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {merchantTransactions.length === 0 && (
            <p className="p-4 text-stone-500 text-center">
              No transactions found.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Parent category: show child category breakdown
  if (isParent && childCategories.length > 0) {
    const childTotals = childCategories
      .map((child) => {
        const total = filtered
          .filter((t) => t.categoryId === child.id)
          .reduce((s, t) => s + t.amount, 0);
        return { name: child.name, amount: Math.round(total), id: child.id };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return (
      <div className="p-6 bg-stone-50 min-h-full">
        <Breadcrumb crumbs={crumbs} />
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {currentCategory!.name}
        </h2>
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          {childTotals.length > 0 && (
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, childTotals.length * 40)}
            >
              <BarChart
                data={childTotals}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <XAxis type="number" tickFormatter={(v) => `€${v}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Amount"]}
                />
                <Bar dataKey="amount" fill="#57534e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 space-y-1">
            {childTotals.map((c) => (
              <Link
                key={c.id}
                to={`/drilldown?month=${month}&category=${c.id}`}
                className="flex justify-between text-sm hover:bg-stone-50 px-2 py-1 rounded"
              >
                <span className="text-stone-700">{c.name}</span>
                <span className="text-stone-900 font-medium">
                  {formatCurrency(c.amount)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Child category: show merchant breakdown
  if (categoryId) {
    const merchantTotals = new Map<string, number>();
    filtered
      .filter((t) => t.categoryId === categoryId)
      .forEach((t) => {
        const name = t.merchantName || "Unknown";
        merchantTotals.set(name, (merchantTotals.get(name) || 0) + t.amount);
      });
    const merchantData = Array.from(merchantTotals.entries())
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount);

    return (
      <div className="p-6 bg-stone-50 min-h-full">
        <Breadcrumb crumbs={crumbs} />
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {currentCategory?.name || "Category"}
        </h2>
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          {merchantData.length > 0 && (
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, merchantData.length * 40)}
            >
              <BarChart
                data={merchantData}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <XAxis type="number" tickFormatter={(v) => `€${v}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Amount"]}
                />
                <Bar dataKey="amount" fill="#78716c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 space-y-1">
            {merchantData.map((m) => (
              <Link
                key={m.name}
                to={`/drilldown?month=${month}&category=${categoryId}&merchant=${encodeURIComponent(m.name)}`}
                className="flex justify-between text-sm hover:bg-stone-50 px-2 py-1 rounded"
              >
                <span className="text-stone-700">{m.name}</span>
                <span className="text-stone-900 font-medium">
                  {formatCurrency(m.amount)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-6 text-stone-500">No category selected.</div>;
}
