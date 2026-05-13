import { cn } from "../lib/utils";

interface Props {
  label: string;
  value: string;
  change?: { value: string; positive: boolean } | null;
  className?: string;
}

export function MetricCard({ label, value, change, className }: Props) {
  return (
    <div className={cn("bg-white border border-stone-200 rounded-lg p-4", className)}>
      <p className="text-xs text-stone-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-stone-900 mt-1">{value}</p>
      {change && (
        <p className={cn("text-xs mt-1", change.positive ? "text-green-600" : "text-red-600")}>
          {change.positive ? "+" : ""}{change.value} vs last month
        </p>
      )}
    </div>
  );
}
