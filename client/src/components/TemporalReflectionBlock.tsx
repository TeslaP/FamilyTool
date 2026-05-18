import { useState } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { formatMonth } from "../lib/utils";

interface Props {
  from: string;
  to: string;
  variant?: "subtle" | "prominent";
}

function getPeriodTitle(from: string, to: string): string {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months = (ty - fy) * 12 + (tm - fm) + 1;

  if (months <= 1) return `${formatMonth(from)} note`;
  if (months <= 3) return "Recent months";
  if (months <= 6) return "Half-year note";
  return "Year so far";
}

export function TemporalReflectionBlock({ from, to, variant = "prominent" }: Props) {
  const [generating, setGenerating] = useState(false);
  const { data, refetch } = useApi(() => api.getTemporalReflection(from, to), [from, to]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateTemporalReflection(from, to);
      refetch();
    } catch {
      // Silently fail
    } finally {
      setGenerating(false);
    }
  };

  // Nothing to show yet and we're in subtle mode (Overview)
  if (!data?.exists && variant === "subtle") return null;

  // Subtle variant (Overview mode) — just show the text
  if (variant === "subtle") {
    if (!data?.reflection) return null;
    return (
      <p className="font-editorial text-sm text-stone-400 italic text-center mt-3">
        {data.reflection}
      </p>
    );
  }

  // Prominent variant (Detail mode)
  const title = getPeriodTitle(from, to);

  return (
    <section className="mb-8">
      <h3 className="text-sm text-stone-400 mb-3">{title}</h3>
      {data?.exists ? (
        <div>
          <p className="font-editorial text-base text-stone-600 leading-relaxed italic">
            {data.reflection}
          </p>
          {data.dataChanged && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs text-stone-300 mt-2 hover:text-stone-500 transition-colors"
            >
              {generating ? "Refreshing..." : "Data has changed · Refresh"}
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="font-editorial text-base text-stone-300 italic hover:text-stone-500 transition-colors"
        >
          {generating ? "Generating..." : "Generate reflection →"}
        </button>
      )}
    </section>
  );
}
