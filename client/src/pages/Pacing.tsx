import { useSearchParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { formatCurrency, formatMonth, getCurrentMonth, cn } from "../lib/utils";
import { ChevronLeft } from "lucide-react";

export function Pacing() {
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") || getCurrentMonth();

  const { data, loading } = useApi(() => api.getPacing(month), [month]);

  if (loading || !data) {
    return <div className="h-[calc(100vh-5rem)] flex items-center justify-center text-stone-400">Loading...</div>;
  }

  const { weeks, projection, totalIncome } = data;
  const currentRemaining = weeks.length > 0 ? weeks[weeks.length - 1].remaining : 0;
  const currentWeek = weeks.length;

  const trendColor = projection.trend === "tightening" ? "text-amber-600" :
                     projection.trend === "improving" ? "text-green-700" : "text-stone-500";

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-6">
      {/* Back link */}
      <div className="absolute top-6 left-20">
        <Link to={`/?month=${month}`} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          <ChevronLeft size={16} />
          {formatMonth(month)}
        </Link>
      </div>

      {/* Hero: remaining */}
      <div className="text-center mb-8">
        <p className="text-base text-stone-400 mb-3">
          Remaining after week {currentWeek}
        </p>
        <p className={cn(
          "text-[5rem] font-light tracking-tight leading-none",
          currentRemaining >= 0 ? "text-green-700" : "text-red-600"
        )}>
          {formatCurrency(currentRemaining)}
        </p>
      </div>

      {/* Projection */}
      <div className="text-center mb-12">
        <p className="text-sm text-stone-400">
          At current pace: {formatCurrency(projection.remaining)} remaining at month-end
        </p>
        <p className={cn("text-sm mt-1", trendColor)}>
          {projection.trend}
        </p>
      </div>

      {/* Weekly list */}
      <div className="space-y-3 mb-12">
        {weeks.map((week: any, i: number) => (
          <div key={week.weekNum} className="flex items-center gap-3 text-base">
            <span className="text-stone-400 w-16">Week {week.weekNum}</span>
            <span className="text-stone-300">·</span>
            <span className="text-stone-600">{formatCurrency(week.spent)} spent</span>
            <span className="text-stone-300">·</span>
            <span className={cn("font-medium", week.remaining >= 0 ? "text-stone-900" : "text-red-600")}>
              {formatCurrency(week.remaining)} left
            </span>
            {i === weeks.length - 1 && (
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 ml-1" />
            )}
          </div>
        ))}
      </div>

      {/* Reflect link at bottom */}
      <div className="text-center">
        <Link
          to={`/`}
          className="font-editorial text-base text-stone-400 italic hover:text-stone-600 transition-colors"
        >
          Back to overview →
        </Link>
      </div>
    </div>
  );
}
