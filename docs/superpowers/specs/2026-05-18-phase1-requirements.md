# Phase 1 Requirements — Data Reliability + Narrative Memory

## Context

The reflection layer only works if the financial substrate is reliable. This phase ensures: data is clean (rules), memory is visible (temporal reflections), narrative is spatial (integrated into Detail mode), and reflection is grounded (prompt depth).

The quality of one AI paragraph matters more than three new screens.

---

## 1. Seed Rule Bootstrapping

### Problem
Every import burns API tokens on merchants seen 50+ times. The existing spreadsheet has ~442 merchant→category pairs that aren't loaded as rules.

### Goal
One-time script that creates categorisation rules from known merchant→category pairs. After running, known merchants match instantly — AI only handles genuinely new merchants.

### Requirements

**Data source:** `Weekly finace planning _ Teslenko.xlsx` "Data+category" sheet (~992 rows, ~442 unique descriptions).

**Rule creation logic:**
- For each unique Description: find most common Category assigned
- Create rule: `matchType: "contains"`, `matchValue: [merchant name]`, `confidence: 0.9`
- Map spreadsheet categories to DB category hierarchy by name
- Skip descriptions <3 chars or too generic
- Skip if rule already exists for that matchValue
- Infer direction from category type (expense/income/transfer)

**Script:** `server/seed-rules.ts`
- Runnable: `cd server && npx tsx seed-rules.ts`
- Idempotent: safe to run multiple times
- Logging: count of rules created, skipped, failed

**Expected result:** ~300-400 rules. Next import: 90%+ auto-categorised via rules.

---

## 2. Temporal Reflection System

### Problem
Months have no narrative identity. When navigating between months or selecting ranges, you see numbers but no character. The product needs a reflection layer that adapts depth to timeframe.

### Core Principle

Reflection depth scales with temporal scope:
- **Single month:** 1 sentence (6-12 words). Chapter title.
- **3 months:** 2 short sentences. Pacing and shifts.
- **6 months / YTD:** 3-4 sentences. Longitudinal awareness.
- **Calendar year:** 4-5 sentences. Pattern interpretation.

No essays. Never longer than 5 sentences.

### Architecture

**Table:**
```sql
temporal_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  reflection TEXT NOT NULL,
  inputHash TEXT,
  generatedAt TEXT NOT NULL,
  updatedAt TEXT,
  UNIQUE(periodStart, periodEnd)
)
```

No `scope` column — output depth derived from date range length.

**API:**
- `GET /api/reflections/temporal?from=YYYY-MM&to=YYYY-MM` — returns cached reflection (or null)
- `POST /api/reflections/temporal/generate` — generates + stores reflection for given period
- `inputHash` stored as metadata to detect when source data has changed

**Generation model — memory artifacts, not live widgets:**
- Stored reflection exists → show it (instant, no API call)
- No reflection exists → show "Generate reflection →"
- Data changed since reflection (hash mismatch) → show subtle "Data has changed" + Refresh option
- Session completes → generate/update reflection for that month
- User clicks Refresh → regenerate

**Never:**
- Regenerate on page load
- Regenerate silently
- Auto-refresh without user action

Reflections are intentional, authored memory objects.

### Prompt by scope

Scope derived from `periodEnd - periodStart`:
- 1 month: "Generate a single sentence (6-12 words) capturing this month's financial character. Observational, not evaluative. No numbers."
- 2-3 months: "Generate 2 sentences observing pacing and shifts over this period."
- 4-6 months: "Generate 3-4 sentences interpreting patterns over this period."
- 7-12 months: "Generate 4-5 sentences capturing the shape of this year financially."

All prompts include: "Be observational, not evaluative. No advice. No motivation."

### Display

**Dashboard Overview:**
- Below "Available in [Month]" label: the single-month reflection (if exists)
- Very subtle, `text-sm text-stone-400 italic`

**Dashboard Detail — primary home:**
- Positioned between Metrics and Weekly Pacing (single month) or between Metrics and Categories (range)
- Adapts size/typography based on scope
- Shows "Generate reflection →" if none exists
- Shows "Data has changed · Refresh" if hash mismatch
- Section title adapts: "May note" / "Spring note" / "Year so far"

**Session History (/reflections) page:**
- Monthly reflections shown above each session entry

### Title naming (by period length)
- 1 month: "[Month] note" (e.g., "May note")
- 2-3 months: "Recent months" or "[Season] note"
- 4-6 months: "Half-year note"
- 7-12 months: "Year so far"

---

## 3. Session History in Detail Mode

### Problem
Session reflections and financial charts are disconnected. Memory isn't spatial.

### Goal
Integrate session data (temporal reflections, intentions, closing notes) into Dashboard Detail mode alongside the financial data.

### Requirements

**Detail mode hierarchy (updated):**
```
Metrics
↓
Temporal reflection (adapts to scope)
↓
Weekly pacing (single month only)
↓
Category breakdown
↓
Merchants
↓
Year-over-year chart (longer ranges)
```

**Temporal reflection block:**
- Shows cached reflection for the current calendar selection
- If single month: one sentence, barely visible
- If range: multi-sentence block, slightly more prominent
- If none exists: "Generate reflection →" link
- If hash mismatch: "Data has changed · Refresh" in `text-xs text-stone-300`
- Typography: `font-editorial` for the reflection text

**No separate trajectory page needed** — everything lives in Detail mode.

---

## 4. AI Prompt Depth (Iterative)

### Problem
Reflections can feel generic. The AI needs richer pre-computed signals to observe specific patterns.

### Goal
Feed structured signals so the AI interprets rather than discovers.

### Signals (add incrementally):

**Start with (Week 1-2):**
1. Category anomalies — categories >25% different from 3-month average
2. Recurring cost changes — same merchant, different amount vs last month

**Add later (Week 3-4):**
3. Spending rhythm — front-loaded vs back-loaded (first half %)
4. New merchants — appearing for first time this month
5. Savings consistency — streak of positive months

### Approach
- Extend `gatherPromptContext` in `server/src/ai/prompts.ts`
- Each signal is a function returning structured data
- Prompt builder includes only notable signals (skip "everything normal")
- AI instructed: "Use these signals to ground your observations. Only reference genuinely notable ones."

### Principle
This is NOT a one-shot build. It's an ongoing tuning practice. Add signals, read output, remove what clutters, keep what illuminates.

---

## Build Order

| # | Item | Type | Effort |
|---|------|------|--------|
| 1 | Seed rule bootstrapping | Script | ~2 hours |
| 2 | Temporal reflections table + API | Backend | ~2 hours |
| 3 | Temporal reflection generation (prompts by scope) | Backend | ~2 hours |
| 4 | Display in Dashboard Detail + Overview | Frontend | ~3 hours |
| 5 | Session completion triggers reflection update | Backend | ~1 hour |
| 6 | AI prompt signals (category anomalies + recurring) | Backend | ~2 hours |

Total: ~12 hours. Then ongoing tuning.

---

## Success Criteria

- Import a month → 90%+ auto-categorised via rules
- Open Detail mode → see temporal reflection for current period (or "Generate →")
- Change scope (3 months, YTD) → reflection adapts depth
- Complete a session → month reflection auto-updates
- AI references specific anomalies, not generic observations
- The product feels like it knows your financial life
