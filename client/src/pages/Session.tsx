import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { HorizonLogoAnimated } from "../components/HorizonLogoAnimated";
import { HorizonLogo } from "../components/HorizonLogo";
import { api } from "../api/client";
import { getCurrentMonth, getPreviousMonth, formatCurrency } from "../lib/utils";

const PROCESSING_MESSAGES = [
  "Looking through this month",
  "Organising your spending",
  "Finding recurring patterns",
  "Preparing your reflection",
  "Gathering context",
  "Looking at pacing over time",
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Quiet hours";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late reflection";
}

type Step = "entry" | "processing" | "review" | "reflection" | "closing";

function filterNotable(transactions: any[]): any[] {
  const expenses = transactions.filter((t: any) => t.direction === "expense");
  const topByAmount = [...expenses].sort((a: any, b: any) => b.amount - a.amount).slice(0, 4);
  const uncategorised = expenses.filter((t: any) => !t.categoryId).slice(0, 2);

  const seen = new Set<number>();
  const result: any[] = [];
  for (const t of [...topByAmount, ...uncategorised]) {
    if (!seen.has(t.id) && result.length < 5) {
      seen.add(t.id);
      result.push(t);
    }
  }
  return result;
}

export function Session() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const month = searchParams.get("month") || getCurrentMonth();

  const [step, setStep] = useState<Step>("entry");
  const [intention, setIntention] = useState("");
  const [reflection, setReflection] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [previousNote, setPreviousNote] = useState<string | null>(null);
  const [notableTransactions, setNotableTransactions] = useState<any[]>([]);
  const reflectionReady = useRef(false);
  const minTimeElapsed = useRef(false);

  // Fetch previous month's closing note for recall
  useEffect(() => {
    const prevMonth = getPreviousMonth(month);
    api.getSessions(prevMonth).then(sessions => {
      if (sessions.length > 0) {
        const last = sessions[0];
        setPreviousNote(last.closingNote || last.intention || null);
      }
    }).catch(() => {});
  }, [month]);

  // Processing: rotate messages every 5s
  useEffect(() => {
    if (step !== "processing") return;
    const interval = setInterval(() => {
      setMessageIndex(i => (i + 1) % PROCESSING_MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [step]);

  // Processing: minimum 8s hold + AI call
  const handleBeginSession = async () => {
    setStep("processing");

    // Start minimum timer
    const minTimer = new Promise<void>(resolve => {
      setTimeout(() => { minTimeElapsed.current = true; resolve(); }, 8000);
    });

    // Start AI call
    const aiCall = api.sessionReflect(month, intention || undefined).then(res => {
      reflectionReady.current = true;
      return res.reflection;
    });

    // Fetch transactions
    const txCall = api.getTransactions({ month });

    // Wait for ALL: minimum time, AI response, and transactions
    const [, reflectionText, allTransactions] = await Promise.all([minTimer, aiCall, txCall]);
    setReflection(reflectionText);

    const notable = filterNotable(allTransactions);
    setNotableTransactions(notable);

    if (notable.length >= 3) {
      setStep("review");
    } else {
      setStep("reflection");
    }
  };

  const handleSaveAndClose = async () => {
    await api.sessionSave({
      month,
      intention: intention || undefined,
      aiReflection: reflection,
      closingNote: closingNote || undefined,
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-stone-100">
      <style>{`
        @keyframes sessionFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .session-enter {
          opacity: 0;
          animation: sessionFadeIn 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .session-enter-delay-1 { animation-delay: 0.2s; }
        .session-enter-delay-2 { animation-delay: 0.4s; }
        .session-enter-delay-3 { animation-delay: 0.6s; }
        .session-enter-delay-4 { animation-delay: 0.8s; }
        @keyframes messageRotate {
          0%, 100% { opacity: 0; transform: translateY(4px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Step 1: Entry */}
      {step === "entry" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="session-enter">
            <HorizonLogo size={48} className="mx-auto mb-8" />
          </div>
          <h1 className="session-enter session-enter-delay-1 text-2xl font-light text-stone-700 text-center mb-2">
            {getTimeGreeting()}
          </h1>
          <p className="session-enter session-enter-delay-2 text-base text-stone-400 text-center mb-12">
            A moment to review this month
          </p>
          {previousNote && (
            <p className="session-enter session-enter-delay-2 text-sm text-stone-300 text-center mb-8 max-w-sm italic">
              Last month you mentioned: &ldquo;{previousNote}&rdquo;
            </p>
          )}
          <div className="session-enter session-enter-delay-3 w-full max-w-md">
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="What's on your mind? (optional)"
              rows={3}
              className="w-full px-5 py-4 bg-white/40 border-none rounded-xl text-lg text-stone-700 placeholder:text-stone-300 focus:outline-none leading-relaxed resize-none"
            />
          </div>
          <button
            onClick={handleBeginSession}
            className="session-enter session-enter-delay-4 mt-8 px-8 py-3 text-base font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Begin →
          </button>
        </div>
      )}

      {/* Step 2: Processing */}
      {step === "processing" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <HorizonLogoAnimated size={64} mode="both" className="mb-12" />
          <p className="text-base text-stone-400 h-6 transition-opacity duration-1000">
            {PROCESSING_MESSAGES[messageIndex]}
          </p>
        </div>
      )}

      {/* Step 2.5: Review notable transactions */}
      {step === "review" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="max-w-md w-full">
            <p className="text-base text-stone-400 text-center mb-2 session-enter">
              A few things that stood out
            </p>
            <p className="text-sm text-stone-300 text-center mb-10 session-enter session-enter-delay-1">
              You can simply notice these and continue.
            </p>
            <div className="space-y-4 session-enter session-enter-delay-2">
              {notableTransactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-stone-100/50 last:border-none">
                  <div>
                    <p className="text-sm text-stone-700">{t.merchantName || t.rawDescription?.slice(0, 30) || "Transaction"}</p>
                    {!t.categoryId && (
                      <span className="text-xs text-stone-300">Uncategorised</span>
                    )}
                  </div>
                  <span className="text-sm tabular-nums font-medium text-stone-800">
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep("reflection")}
            className="session-enter session-enter-delay-3 mt-12 px-8 py-3 text-base text-stone-400 hover:text-stone-700 transition-colors"
          >
            Continue &rarr;
          </button>
        </div>
      )}

      {/* Step 3: Reflection */}
      {step === "reflection" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="max-w-xl session-enter">
            <div className="font-editorial text-lg text-stone-600 leading-[1.8] space-y-6">
              {reflection.split("\n\n").filter(Boolean).map((paragraph, i) => (
                <p key={i} className="session-enter" style={{ animationDelay: `${i * 0.3}s` }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep("closing")}
            className="session-enter session-enter-delay-4 mt-12 px-8 py-3 text-base text-stone-400 hover:text-stone-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 4: Closing */}
      {step === "closing" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="session-enter">
            <HorizonLogo size={36} className="mx-auto mb-8" />
          </div>
          <p className="session-enter session-enter-delay-1 text-base text-stone-400 text-center mb-8">
            What would you like to carry into next month?
          </p>
          <textarea
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            placeholder="Optional..."
            rows={4}
            className="session-enter session-enter-delay-2 w-full max-w-md px-5 py-4 bg-white/40 border-none rounded-xl text-lg text-stone-700 placeholder:text-stone-300 focus:outline-none leading-relaxed resize-none"
          />
          <button
            onClick={handleSaveAndClose}
            className="session-enter session-enter-delay-3 mt-8 px-8 py-3 text-base text-stone-400 hover:text-stone-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
