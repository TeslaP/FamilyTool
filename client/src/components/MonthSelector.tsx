import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { formatMonth, getPreviousMonth, getNextMonth, getCurrentMonth, cn } from "../lib/utils";

export interface MonthRange {
  from: string;
  to: string;
  label?: string;
}

interface Props {
  month: string;
  range?: MonthRange | null;
  onChange: (month: string) => void;
  onRangeChange?: (range: MonthRange | null) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getPresets(viewYear: number) {
  const current = getCurrentMonth();
  const currentYearNum = parseInt(current.split("-")[0]);
  const last = getPreviousMonth(current);
  const m3 = getPreviousMonth(getPreviousMonth(last));
  const m6 = (() => { let m = current; for (let i = 0; i < 5; i++) m = getPreviousMonth(m); return m; })();

  return [
    { label: "This month", from: current, to: current },
    { label: "Last month", from: last, to: last },
    { label: "Last 3 months", from: m3, to: current },
    { label: "Last 6 months", from: m6, to: current },
    {
      label: "Year to date",
      from: `${viewYear}-01`,
      to: viewYear < currentYearNum ? `${viewYear}-12` : current,
    },
    {
      label: "Calendar year",
      from: `${viewYear}-01`,
      to: `${viewYear}-12`,
    },
  ];
}

export function MonthSelector({ month, range, onChange, onRangeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseInt(month.split("-")[0]));
  const ref = useRef<HTMLDivElement>(null);

  const currentMonthNum = parseInt(month.split("-")[1]);
  const currentYear = parseInt(month.split("-")[0]);
  const presets = getPresets(viewYear);

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
    onRangeChange?.(null);
    setOpen(false);
  };

  const selectPreset = (preset: { label: string; from: string; to: string }) => {
    onChange(preset.from);
    if (preset.from === preset.to) {
      onRangeChange?.(null);
    } else {
      onRangeChange?.({ from: preset.from, to: preset.to, label: preset.label });
    }
    setOpen(false);
  };

  // Display label
  const displayLabel = range?.label
    ? range.label
    : formatMonth(month);

  const displaySubtitle = range && range.from !== range.to
    ? `${formatMonth(range.from)} – ${formatMonth(range.to)}`
    : null;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (range) {
              onChange(getPreviousMonth(range.to));
            } else {
              onChange(getPreviousMonth(month));
            }
            onRangeChange?.(null);
          }}
          className="p-1.5 hover:bg-stone-100 rounded-md"
        >
          <ChevronLeft size={20} className="text-stone-400" />
        </button>

        <button
          onClick={() => { setViewYear(currentYear); setOpen(!open); }}
          className="flex flex-col items-center gap-0.5 hover:bg-stone-100 px-3 py-1.5 rounded-md min-w-[160px]"
        >
          <span className="flex items-center gap-1.5 text-base font-medium text-stone-900">
            {displayLabel}
            <ChevronDown size={14} className={cn("text-stone-400", open && "rotate-180")} />
          </span>
          {displaySubtitle && (
            <span className="text-xs text-stone-400">{displaySubtitle}</span>
          )}
        </button>

        <button
          onClick={() => {
            if (range) {
              onChange(getNextMonth(range.to));
            } else {
              onChange(getNextMonth(month));
            }
            onRangeChange?.(null);
          }}
          className="p-1.5 hover:bg-stone-100 rounded-md disabled:opacity-30"
          disabled={range ? range.to >= getCurrentMonth() : month >= getCurrentMonth()}
        >
          <ChevronRight size={20} className="text-stone-400" />
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-stone-100 p-4 z-50 w-72">
          {/* Year selector */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewYear(viewYear - 1)} className="p-1 hover:bg-stone-100 rounded transition-colors duration-200">
              <ChevronLeft size={16} className="text-stone-500" />
            </button>
            <span className="text-sm font-medium text-stone-900">{viewYear}</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="p-1 hover:bg-stone-100 rounded transition-colors duration-200">
              <ChevronRight size={16} className="text-stone-500" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1 mb-4">
            {MONTHS.map((name, i) => {
              const monthNum = i + 1;
              const monthStr = `${viewYear}-${String(monthNum).padStart(2, "0")}`;
              const isSelected = !range && viewYear === currentYear && monthNum === currentMonthNum;
              const isInRange = range && monthStr >= range.from && monthStr <= range.to;
              const isFuture = monthStr > getCurrentMonth();

              return (
                <button
                  key={name}
                  onClick={() => selectMonth(monthNum)}
                  disabled={isFuture}
                  className={cn(
                    "py-1.5 px-2 text-sm rounded-md transition-colors duration-200",
                    isSelected ? "bg-stone-700 text-white" :
                    isInRange ? "bg-stone-200 text-stone-900" :
                    "text-stone-700 hover:bg-stone-100",
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
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors duration-200",
                  range?.label === preset.label
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
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
