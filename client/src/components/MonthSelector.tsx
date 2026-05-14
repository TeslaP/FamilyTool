import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { formatMonth, getPreviousMonth, getNextMonth, getCurrentMonth, cn } from "../lib/utils";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRESETS = [
  { label: "This month", getValue: () => getCurrentMonth() },
  { label: "Last month", getValue: () => getPreviousMonth(getCurrentMonth()) },
  { label: "Last 3 months", getValue: () => getPreviousMonth(getPreviousMonth(getCurrentMonth())) },
  { label: "Last 6 months", getValue: () => {
    let m = getCurrentMonth();
    for (let i = 0; i < 5; i++) m = getPreviousMonth(m);
    return m;
  }},
];

export function MonthSelector({ month, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseInt(month.split("-")[0]));
  const ref = useRef<HTMLDivElement>(null);

  const currentMonthNum = parseInt(month.split("-")[1]);
  const currentYear = parseInt(month.split("-")[0]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectMonth = (monthNum: number) => {
    const selected = `${viewYear}-${String(monthNum).padStart(2, "0")}`;
    onChange(selected);
    setOpen(false);
  };

  const selectPreset = (getValue: () => string) => {
    onChange(getValue());
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(getPreviousMonth(month))}
          className="p-1.5 hover:bg-stone-100 rounded-md transition-colors"
        >
          <ChevronLeft size={20} className="text-stone-600" />
        </button>

        <button
          onClick={() => { setViewYear(currentYear); setOpen(!open); }}
          className="flex items-center gap-1.5 text-base font-medium text-stone-900 hover:bg-stone-100 px-3 py-1.5 rounded-md transition-colors min-w-[160px] justify-center"
        >
          {formatMonth(month)}
          <ChevronDown size={14} className={cn("text-stone-400 transition-transform", open && "rotate-180")} />
        </button>

        <button
          onClick={() => onChange(getNextMonth(month))}
          className="p-1.5 hover:bg-stone-100 rounded-md transition-colors disabled:opacity-30"
          disabled={month >= getCurrentMonth()}
        >
          <ChevronRight size={20} className="text-stone-600" />
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-stone-200 p-4 z-50 w-72">
          {/* Year selector */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewYear(viewYear - 1)} className="p-1 hover:bg-stone-100 rounded">
              <ChevronLeft size={16} className="text-stone-500" />
            </button>
            <span className="text-sm font-medium text-stone-900">{viewYear}</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="p-1 hover:bg-stone-100 rounded">
              <ChevronRight size={16} className="text-stone-500" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1 mb-4">
            {MONTHS.map((name, i) => {
              const monthNum = i + 1;
              const isSelected = viewYear === currentYear && monthNum === currentMonthNum;
              const isFuture = `${viewYear}-${String(monthNum).padStart(2, "0")}` > getCurrentMonth();

              return (
                <button
                  key={name}
                  onClick={() => selectMonth(monthNum)}
                  disabled={isFuture}
                  className={cn(
                    "py-1.5 px-2 text-sm rounded-md transition-colors",
                    isSelected ? "bg-stone-700 text-white" : "text-stone-700 hover:bg-stone-100",
                    isFuture && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Presets */}
          <div className="border-t border-stone-100 pt-3 space-y-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset.getValue)}
                className="w-full text-left px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 rounded-md transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
