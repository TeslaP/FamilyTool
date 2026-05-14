import { cn } from "../lib/utils";

interface Props {
  label: string;
  value: string;
  change?: { value: string; positive: boolean } | null;
  className?: string;
}

export function MetricCard({ label, value, change, className }: Props) {
  return (
    <div className={cn("bg-white border border-stone-100 rounded-xl p-5 shadow-card", className)}>
      <p className="text-sm text-stone-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-medium text-stone-900 mt-1">{value}</p>
      {change && (
        <p className={cn("text-sm mt-1", change.positive ? "text-green-600" : "text-red-600")}>
          {change.positive ? "+" : ""}{change.value} vs last month
        </p>
      )}
    </div>
  );
}
