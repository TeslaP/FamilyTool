import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, getPreviousMonth, getNextMonth, getCurrentMonth } from "../lib/utils";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ month, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(getPreviousMonth(month))}
        className="p-1 hover:bg-stone-100 rounded"
      >
        <ChevronLeft size={18} className="text-stone-600" />
      </button>
      <span className="text-sm font-medium text-stone-900 min-w-[140px] text-center">
        {formatMonth(month)}
      </span>
      <button
        onClick={() => onChange(getNextMonth(month))}
        className="p-1 hover:bg-stone-100 rounded disabled:opacity-30"
        disabled={month >= getCurrentMonth()}
      >
        <ChevronRight size={18} className="text-stone-600" />
      </button>
    </div>
  );
}
