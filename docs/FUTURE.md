# FamilyTool — Future Plans

## Current State (as of May 2026)

### Shipped
- Transaction import pipeline (TAB/XLS, preview/confirm, duplicate detection)
- AI categorisation (OpenAI, Dutch banking context, child process, caching, rules)
- **~400 pre-seeded categorisation rules** (90%+ auto-categorisation for known merchants)
- Dashboard: Overview (hero + categories) + Detail (scrollable connected report)
- **Pacing chart + category breakdown as one connected system** (click bar → filters categories)
- **Category breakdown:** summary/expanded toggle, percentages, <1% handling, whole euros
- **Temporal reflection system** (scope-adaptive: month → quarter → half → year)
- Horizon Sessions: 4-step reflection flow with continuity + notable transactions
- Session History archive (text-led, months as chapters)
- Contextual AI: trend signals, category anomalies, recurring cost changes, MoM awareness
- Calendar: range presets, year navigation, "Calendar year" preset, chevron-from-end behavior
- Forecast: fixed/variable breakdown, 1-month / 3-month / till-EOY periods
- Visual design system: 4 typographic modes, unified motion, seasonal tints, neutral hero
- Sidebar: Dashboard, Forecast, Reflections, Transactions, Import + About popup

### Architecture
- Prompt registry (categorise, reflect, analyse — separate purposes)
- **Temporal reflections** (scope-adaptive memory artifacts, input hash, never auto-refresh)
- AI import as detached child process
- Session as orchestration layer (same data, different container)
- Month state via React context
- SQLite WAL mode, local-first, pre-import backups

---

## Phase 1 — Deepen the Moat (Narrative Intelligence) — MOSTLY SHIPPED

### ✅ Temporal Reflection System (shipped)
- Scope-adaptive reflections: 1 sentence (month) → 5 sentences (year)
- Stored as memory artifacts (never auto-refresh, user-initiated)
- Input hash for change detection
- Integrated into Dashboard Overview (subtle) + Detail (prominent)
- Generated on session completion + on-demand

### ✅ Seed Rule Bootstrapping (shipped)
- 392 rules extracted from historical spreadsheet data
- 90%+ auto-categorisation for known merchants
- Script: `server/seed-rules.ts`

### ✅ AI Prompt Depth — Category Anomalies + Recurring Changes (shipped)
- Categories >25% different from 3-month average detected and fed to prompt
- Recurring cost changes (same merchant, different amount) detected
- AI references signals only when genuinely notable

### Remaining (next to build)
- **Session history integrated visually into Detail mode** — condensed session notes alongside financial sections
- **Intention carry-over** — surface unmet recurring intentions ("You mentioned X in March and April...")
- **AI prompt tuning** (ongoing practice, not a single build)

---

## Phase 2 — Selective Operational Strengthening

Only the operational improvements that strengthen the reflection experience.

### Recurring Transaction Detection
- Auto-flag monthly patterns (same merchant, similar amount, monthly cadence)
- Surface in forecast as committed costs
- Fits the philosophy: recurring costs are temporal patterns
- Allow manual override

### Better Import Robustness
- Handle edge cases in TAB/XLS parsing
- Better error messages for malformed files
- Progress indication during large AI batch processing

### Year-End Reflection (when 6+ months of sessions exist)
- Auto-generated annual retrospective from all sessions + trajectory
- Not an annual report — an annual *reflection*
- Surfaces: seasonal patterns, intention progress, spending themes
- Deferred until real longitudinal data exists

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
