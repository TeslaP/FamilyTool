# FamilyTool — Future Plans

## Current State (as of May 2026)

### Shipped
- Transaction import pipeline (TAB/XLS, preview/confirm, duplicate detection)
- AI categorisation (OpenAI, Dutch banking context, child process, caching, rules)
- Dashboard: Overview (hero + categories) + Detail (scrollable report with weekly pacing, trajectory, merchants)
- Horizon Sessions: 4-step reflection flow with continuity (intentions, recall, closing notes)
- Session History archive (text-led, months as chapters)
- Contextual AI: trend signals, month-over-month awareness, previous session recall
- In-session notable transaction review (3+ threshold, read-only grounding)
- Calendar: range presets, year navigation, "Calendar year" preset, chevron-from-end behavior
- Forecast: fixed/variable breakdown, 1-month / 3-month / till-EOY periods
- Visual design system: Inter + Newsreader, stone palette, seasonal tints, unified motion (200/600/1200ms)
- Session mode transition (400ms blur threshold)
- Animated Horizon logo, page crossfades, scroll fade-in, hero count-up
- Review: spreadsheet table, bulk actions, delete, confirm, create rules, badge

### Architecture
- Prompt registry (categorise, reflect, analyse — separate purposes)
- AI import as detached child process
- Session as orchestration layer (same data, different container)
- Month state via React context
- SQLite WAL mode, local-first, pre-import backups

---

## Phase 1 — Deepen the Moat (Narrative Intelligence)

The differentiated idea is **reflective continuity**, not operational finance tooling. Double down here first.

### Monthly Phrases
- Each month gets a short AI-generated sentence capturing its character
- Generated after a session (or on-demand from trajectory view)
- Examples: "A month of recovery after a busy winter." / "Spending stabilised as routines returned."
- Stored permanently, shown when scrolling through months
- Visible on trajectory page as annotations alongside spending data
- Transforms months into remembered periods

### Session History on Trajectory
- Trajectory page currently shows savings + spending charts
- Add: reflection snippets alongside the timeline
- Each month shows its phrase, intention, and closing note inline with the charts
- Financial memory becomes *visible* — not just numbers, but narrative

### Year-End Reflection
- Auto-generated annual retrospective from all sessions + trajectory data
- Not an annual report — an annual *reflection*
- Surfaces: seasonal patterns, intention progress, spending themes, memorable months
- Calm, observational, editorial tone (Newsreader typography)
- The signature feature of the product

### Intention Carry-Over
- Unmet or recurring intentions surface across months
- "You mentioned 'reduce dining' in March and April — dining has decreased by 15% since."
- AI connects current reality to past stated goals without being prescriptive

---

## Phase 2 — Selective Operational Strengthening

Only the operational improvements that strengthen the reflection experience.

### Seed Data Bootstrapping (HIGH PRIORITY)
- Extract ~442 merchant→category pairs from existing spreadsheet as rules
- Reduces AI categorisation calls to near-zero for known merchants
- One-time setup script, massive friction reduction
- Makes the tool usable day-one without burning API tokens

### Recurring Transaction Detection
- Auto-flag monthly patterns (same merchant, similar amount, monthly cadence)
- Surface in forecast as committed costs
- Fits the philosophy: recurring costs are temporal patterns
- Allow manual override

### Better Import Robustness
- Handle edge cases in TAB/XLS parsing
- Better error messages for malformed files
- Progress indication during large AI batch processing

---

## Phase 3 — Minimal Packaging

Not a product launch. Just: make it usable outside your own machine.

### Desktop Packaging (Tauri)
- Lightweight native wrapper
- Menu bar presence
- Auto-start option
- Native file drop for imports
- Horizon psychologically fits desktop software more than SaaS

### Onboarding Flow
- First-time import guidance
- Rule seeding from spreadsheet
- OpenAI key setup walkthrough
- "Your first month" gentle introduction

### Monthly Reminder
- In-app card: "Your May reflection is ready"
- Not push notifications — just a quiet presence on the dashboard
- Future: downloadable .ics calendar event

---

## Deferred (Not Now)

- Product rename to "Horizon" (wait for branding to stabilise)
- Multi-account support
- Bank API sync
- Mobile app
- Cloud sync
- Advanced forecasting/ML
- Category management UI (can wait)
- Settings page complexity (can wait)
- Landing page / marketing site
- Gamification (never)

---

## Strategic Positioning

This is NOT a better budgeting app.

This is **software that helps people contextualise their financial life over time.**

The moat is:
- Memory (sessions accumulate into narrative)
- Pacing (runway awareness, not budget pressure)
- Continuity (each month references the last)
- Emotional tone (calm, observational, restrained)

The grounding MUST remain:
- Real transactions
- Real patterns
- Operational truth

The reflection layer works BECAUSE it sits on top of real financial structure. That balance is the product.

---

## Design Principles (Unchanged)

- Calm over efficient
- Reflective over analytical
- Observational over prescriptive
- Memory over metrics
- Stillness over motion
- 80% practical finance tool, 20% reflective atmosphere
