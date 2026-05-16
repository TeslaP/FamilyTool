import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { formatMonth } from "../lib/utils";

export function SessionHistory() {
  const { data: sessions, loading } = useApi(() => api.getSessions(), []);

  if (loading) {
    return <div className="p-8 text-stone-400">Loading...</div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-medium text-stone-900 mb-8">Reflections</h1>
        <p className="font-editorial text-lg text-stone-400 italic">
          No reflections yet. Complete a session to begin building your financial memory.
        </p>
      </div>
    );
  }

  // Group by year
  const byYear = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const year = s.month.split("-")[0];
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(s);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-medium text-stone-900 mb-12">Reflections</h1>

      {Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([year, yearSessions]) => (
        <div key={year} className="mb-16">
          <p className="text-sm text-stone-300 mb-8">{year}</p>
          <div className="space-y-12">
            {yearSessions.map((session: any) => (
              <div key={session.id}>
                <h3 className="text-base font-medium text-stone-700 mb-3">
                  {formatMonth(session.month)}
                </h3>
                <p className="font-editorial text-base text-stone-600 leading-relaxed italic mb-3">
                  {session.aiReflection.split("\n\n")[0]}
                </p>
                {session.intention && (
                  <p className="text-sm text-stone-400 mb-1">
                    Intention: {session.intention}
                  </p>
                )}
                {session.closingNote && (
                  <p className="text-sm text-stone-400">
                    Note: {session.closingNote}
                  </p>
                )}
                <div className="mt-6 border-b border-stone-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
