import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Loader2 } from "lucide-react";

export function AiStatusBar() {
  const [status, setStatus] = useState<{ uncategorised: number; categorised: number; total: number; isProcessing: boolean } | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const s = await api.getImportStatus();
        setStatus(s);
        if (!s.isProcessing) {
          clearInterval(interval);
          // Hide after a moment
          setTimeout(() => setStatus(null), 3000);
        }
      } catch {
        setStatus(null);
      }
    };

    check();
    interval = setInterval(check, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (!status || !status.isProcessing) return null;

  const progress = status.total > 0
    ? Math.round(((status.total - status.uncategorised) / status.total) * 100)
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-stone-200 rounded-xl shadow-card px-4 py-3 flex items-center gap-3 z-40">
      <Loader2 size={16} className="text-stone-500 animate-spin" />
      <div className="text-sm">
        <p className="text-stone-700 font-medium">AI categorising...</p>
        <p className="text-stone-500">{status.uncategorised} remaining · {progress}% done</p>
      </div>
    </div>
  );
}
