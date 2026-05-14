import { createContext, useContext, useState, type ReactNode } from "react";
import { getCurrentMonth } from "../lib/utils";
import type { MonthRange } from "../components/MonthSelector";

interface MonthContextType {
  month: string;
  range: MonthRange | null;
  setMonth: (month: string) => void;
  setRange: (range: MonthRange | null) => void;
}

const MonthCtx = createContext<MonthContextType | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState(getCurrentMonth());
  const [range, setRangeState] = useState<MonthRange | null>(null);

  const setMonth = (newMonth: string) => {
    setMonthState(newMonth);
    setRangeState(null);
  };

  const setRange = (newRange: MonthRange | null) => {
    if (newRange) {
      setMonthState(newRange.from);
    }
    setRangeState(newRange);
  };

  return (
    <MonthCtx.Provider value={{ month, range, setMonth, setRange }}>
      {children}
    </MonthCtx.Provider>
  );
}

export function useMonthParam(defaultMonth?: string) {
  const ctx = useContext(MonthCtx);
  if (!ctx) {
    throw new Error("useMonthParam must be used within MonthProvider");
  }
  return ctx;
}
