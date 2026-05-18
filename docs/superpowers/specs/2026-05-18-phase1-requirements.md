# Phase 1 Requirements — Data Reliability + Narrative Memory

## Context

The reflection layer only works if the financial substrate is reliable. This phase ensures: data is clean (rules), memory is visible (phrases), narrative is spatial (trajectory integration), and reflection is grounded (prompt depth).

The quality of one AI paragraph matters more than three new screens.

---

## 1. Seed Rule Bootstrapping

### Problem
Every import burns API tokens on merchants seen 50+ times. The existing spreadsheet has ~442 merchant→category pairs. Currently these aren't loaded as rules, so the categorisation engine starts cold every time.

### Goal
One-time script that extracts merchant→category pairs from the existing categorised data and creates categorisation rules. After running, known merchants match instantly via rules — AI only handles genuinely new merchants.

### Requirements

**Data source:** The `Weekly finace planning _ Teslenko.xlsx` "Data+category" sheet. Contains ~992 rows with Description + Category columns. ~442 unique Description→Category pairs.

**Rule creation logic:**
- For each unique Description value in the spreadsheet:
  - Find the most common Category assigned to it
  - Create a categorisation rule: `matchType: "contains"`, `matchValue: [cleaned merchant name]`, `categoryId: [mapped ID]`
- Map spreadsheet categories to the DB category hierarchy (name matching)
- Skip descriptions that are too short (<3 chars) or too generic
- Skip if a rule already exists for that matchValue

**Merchant name cleaning:**
- The spreadsheet "Description" column has cleaned merchant names (e.g., "Albert Heijn", "ABN AMRO BANK NV")
- These become the `matchValue` AND `merchantName` on the rule

**Output:**
- Script: `server/seed-rules.ts`
- Runnable: `cd server && npx tsx seed-rules.ts`
- Idempotent: safe to run multiple times (skips existing rules)
- Logging: shows count of rules created, skipped, failed

**Expected result:**
- ~300-400 rules created (some descriptions may not map to categories)
- Next import: majority of transactions match rules instantly
- AI only called for genuinely unknown merchants

### Architecture Decision
- One-time script, not an API endpoint
- Rules stored in existing `categorisation_rules` table
- Uses `matchType: "contains"` with `confidence: 0.9`
- Direction inferred from category type (expense/income/transfer)

---

## 2. Monthly Phrases

### Problem
Months are currently just numbers on the calendar. They have no identity. When scrolling through months, you see amounts but no character. The trajectory page shows charts but no narrative alongside them.

### Goal
Each month gets a short AI-generated sentence (10-15 words max) capturing its financial character. Stored permanently, shown when navigating between months.

### Requirements

**Generation:**
- Generated after a session completion (piggyback on the reflection)
- OR: generated on-demand from the trajectory/dashboard view
- Uses the same financial context as the reflection prompt but with a much tighter instruction

**Prompt:**
- System: "Generate a single sentence (10-15 words) capturing the character of this month financially. Be observational, not evaluative. No numbers. Think of it as a chapter title."
- Input: month totals, top categories, trends, previous month phrase (if exists)
- Output: one sentence, stored as-is

**Examples:**
- "A month of recovery after a busy winter."
- "Spending stabilised as routines returned."
- "A quieter month with fewer surprises."
- "Travel-heavy, with dining and activities elevated."

**What it is NOT:**
- Not a summary (no numbers)
- Not advice
- Not evaluative ("good month" / "bad month")
- Not motivational

**Storage:**
- New column on `session_reflections`: `monthPhrase TEXT`
- OR: new lightweight table: `monthly_phrases (month TEXT PRIMARY KEY, phrase TEXT, createdAt TEXT)`
- I'd recommend the separate table — phrases should exist independently of sessions (you might want to generate one without doing a full session)

**Display locations:**
- MonthSelector dropdown: below each month name, show its phrase (if exists) in small italic text
- Dashboard Overview: below the "Available in May 2025" label, show the phrase
- Trajectory page: alongside each month's bar/data point
- Session History page: above each month's reflection entry

**Architecture Decision:**
- Separate `monthly_phrases` table (independent of sessions)
- API: `POST /api/phrases/generate` (generates for a month) + `GET /api/phrases?month=YYYY-MM`
- Generated as part of session save (after reflection, the server also generates a phrase)
- Can also be generated standalone (trajectory view "generate phrase" for months without one)

---

## 3. Session History on Trajectory

### Problem
The trajectory page shows savings + spending charts. The session history page shows reflections. These are separate pages with no connection. Financial memory isn't *spatial* — you can't see how reflections relate to the spending patterns visually.

### Goal
Integrate session data (phrases, intentions, notes) into the trajectory page alongside the financial charts. The timeline becomes both quantitative AND narrative.

### Requirements

**What to show:**
- Below each month's bar in the spending chart: the monthly phrase (if exists)
- Below the charts section: a condensed session timeline (same data as /reflections but inline)
- Each month entry shows: phrase + intention + closing note (one line each, very compact)

**What NOT to show:**
- The full AI reflection text (too long for inline display)
- Every session if multiple exist per month (show latest only)

**Layout:**
```
[Savings chart]
[Progress bars]

[Monthly spending chart]
  Jan   Feb   Mar   Apr   May
  ███   ███   ███   ███   ███
  "A    "Sett "Reco  "Tra  "Quie
   busy  ling  very   vel   ter
   start" in"  month" heavy" month"

[Session notes - condensed]
May: "Spending stabilised..." — intention: reduce dining
Apr: "Travel heavy..." — note: worth it for the family
Mar: "Settling into rhythm"
```

**Design:**
- Phrases below chart bars: `text-xs text-stone-400 italic` (very small, supplementary)
- Session timeline: same text-led style as the Reflections page but more compact (one line per month, not full paragraphs)
- No cards. Just text flowing down the page.

**Architecture Decision:**
- Trajectory page fetches both `/api/trajectory` (financial data) AND `/api/session` (all sessions) AND `/api/phrases` (all phrases)
- Merges them client-side by month
- No new API endpoints needed — existing ones cover it

---

## 4. AI Prompt Depth (Iterative, Not a Single Build)

### Problem
Current reflections can feel generic — "spending was stable, savings on track." The AI has limited context and produces surface-level observations. With more signals, it could identify genuine patterns.

### Goal
Feed richer, pre-computed signals to the reflection prompt so the AI has specific things to be observational about. The AI should *interpret*, not *discover*.

### Requirements

**Additional signals to compute and feed (incrementally):**

1. **Category anomalies** — categories that are significantly different from their 3-month average
   - Example: `{ category: "Dining", thisMonth: 450, average: 280, deviation: "+60%" }`
   - Only include deviations >25%

2. **Recurring cost changes** — did any recurring costs change amount?
   - Example: `{ merchant: "Ziggo", was: 65, now: 72, change: "increased" }`

3. **Spending rhythm** — was spending front-loaded or back-loaded in the month?
   - Example: `{ rhythm: "front-loaded", firstHalfPercent: 68 }`

4. **New merchants** — merchants appearing for the first time this month
   - Example: `{ newMerchants: ["Booking.com", "ANWB"] }`

5. **Savings consistency** — streak of positive savings months
   - Example: `{ savingsStreak: 4, averageSavingsRate: 12 }`

**Prompt update:**
- Add a "SIGNALS" section to the user message with these pre-computed observations
- Instruct the AI: "Use these signals to ground your observations. Only reference signals that are genuinely notable. Do not mention every signal."

**Iteration approach:**
- Start with signals 1-2 (category anomalies + recurring changes) — these have the highest observational value
- Add 3-5 over subsequent weeks based on reflection quality
- Read output critically each time — tune what's included based on whether it improves or clutters the narrative

### Architecture Decision
- Extend `gatherPromptContext` in `server/src/ai/prompts.ts`
- Each signal is a function that queries the DB and returns structured data
- The prompt builder decides which signals to include based on whether they're notable (skip "everything normal" signals)
- This is NOT a one-shot build — it's an ongoing tuning practice

---

## Build Order

| # | Item | Type | Effort | Dependencies |
|---|------|------|--------|--------------|
| 1 | Seed rule bootstrapping | Script | ~2 hours | None |
| 2 | Monthly phrases (table + API + generation) | Feature | ~3 hours | None |
| 3 | Monthly phrases (display in UI) | UI | ~2 hours | #2 |
| 4 | Session history on trajectory | UI | ~3 hours | #2 |
| 5 | AI prompt signals (category anomalies + recurring) | Backend | ~2 hours | None |
| 6 | AI prompt tuning (iterative) | Ongoing | — | #5, real usage |

Total concrete build: ~12 hours across 1-2 weeks.

---

## Success Criteria

After this phase:
- Import a new month → 90%+ auto-categorised via rules (no AI needed for known merchants)
- Navigate months → each has a phrase capturing its character
- Trajectory page → financial data AND narrative memory visible together
- Run a session → AI references specific anomalies and patterns, not generic observations
- The product feels like it *knows your financial life*

---

## What This Phase Does NOT Include

- Year-end review (need 6+ months of real sessions first)
- Category management UI
- Settings page
- Desktop packaging
- Product rename
- New UI screens (only modifications to existing pages)
