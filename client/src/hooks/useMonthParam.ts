import { useSearchParams } from "react-router-dom";
import { getCurrentMonth } from "../lib/utils";
import type { MonthRange } from "../components/MonthSelector";

export function useMonthParam(defaultMonth?: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const month = searchParams.get("month") || defaultMonth || getCurrentMonth();

  const rangeFrom = searchParams.get("from");
  const rangeTo = searchParams.get("to");
  const rangeLabel = searchParams.get("rangeLabel");

  const range: MonthRange | null = rangeFrom && rangeTo
    ? { from: rangeFrom, to: rangeTo, label: rangeLabel || undefined }
    : null;

  const setMonth = (newMonth: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", newMonth);
    params.delete("from");
    params.delete("to");
    params.delete("rangeLabel");
    setSearchParams(params, { replace: true });
  };

  const setRange = (newRange: MonthRange | null) => {
    const params = new URLSearchParams(searchParams);
    if (newRange) {
      params.set("month", newRange.from);
      params.set("from", newRange.from);
      params.set("to", newRange.to);
      if (newRange.label) {
        params.set("rangeLabel", newRange.label);
      } else {
        params.delete("rangeLabel");
      }
    } else {
      params.delete("from");
      params.delete("to");
      params.delete("rangeLabel");
    }
    setSearchParams(params, { replace: true });
  };

  return { month, range, setMonth, setRange };
}
