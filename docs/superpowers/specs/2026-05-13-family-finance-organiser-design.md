# Family Finance Organiser — Design Spec

## Overview

A local-first family financial operating system that replaces a manual spreadsheet workflow. Imports ABN AMRO bank exports, categorises transactions using AI, tracks budgets and savings, and provides monthly financial visibility with drilldown analytics.

Single user, single account, monthly rhythm. Deterministic system for numbers, AI for explanation and categorisation.

## Architecture

**Approach:** Vite SPA frontend + local Express/Node backend.

- Frontend: React, TypeScript, Tailwind, shadcn/ui, Recharts
- Backend: Express, TypeScript, better-sqlite3
- AI: OpenAI API (gpt-4o-mini for categorisation, gpt-4o for summaries)
- Dev: Single `npm run dev` starts both (concurrently)
- Auth: Single username/password, JWT session

```
FamilyTool/
├── client/              # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── pages/       # Dashboard, Import, Review, Forecast, Login
│   │   ├── components/  # Shared UI components
│   │   └── api/         # HTTP client to backend
│   └── ...
├── server/              # Express + TypeScript backend
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic (parser, categoriser, forecast, recalculation)
│   │   ├── db/          # SQLite schema, migrations, queries
│   │   ├── ai/          # OpenAI integration
│   │   └── backup/      # SQLite snapshot management
│   └── ...
├── data/                # SQLite database file, uploaded bank exports, backups
└── samples/             # Test fixtures (.TAB/.XLS files)
```

## Import Pipeline

1. User uploads .TAB or .XLS file via the UI
2. Backend detects file type, parses into raw rows
3. **Pre-import backup** created automatically
4. **Preview shown to user**: parsed transactions, detected duplicates, estimated categories
5. User confirms import
6. Each row becomes a normalised transaction record with explicit direction (income/expense/transfer)
7. Check existing categorisation rules — apply where matched (with confidence scores)
8. Remaining uncategorised transactions sent to OpenAI in batches of ~50
9. Duplicates detected by fingerprint (date + amount + description hash)
10. Results stored in SQLite
11. Monthly aggregates recalculated
12. User sees import summary (imported, duplicates skipped, categorised, sent to review)

### Import Preview (Before Commit)

Upload does NOT immediately write to the database. Flow:

```
Upload file
→ Parse and validate
→ Show preview: row count, date range, duplicates detected
→ Show estimated categorisation (rules only, no AI yet)
→ User confirms or cancels
→ On confirm: commit to DB, run AI categorisation on unknowns
```

This prevents accidental imports and increases recoverability.

### ABN AMRO TAB format

Tab-separated, no header row, 8 fields:

```
accountNumber | currency | transactionDate(YYYYMMDD) | startBalance | endBalance | valueDate(YYYYMMDD) | amount | description
```

### ABN AMRO XLS format

Same data with header row:

```
accountNumber | mutationcode | transactiondate | valuedate | startsaldo | endsaldo | amount | description
```

Column order differs between formats. Parser handles both.

Note: TAB format uses comma as decimal separator (e.g. `1282,61`). Parser must normalise to standard floats.

### Duplicate detection

Fingerprint = hash of (transactionDate + amount + first 50 chars of description). If fingerprint exists in DB, skip. Show count of skipped duplicates in import summary.

## Transaction Direction

Every transaction has an explicit `direction` field:

- **income** — salary, refunds, interest
- **expense** — purchases, bills, subscriptions
- **transfer** — between own accounts, credit card payments, savings moves

Direction is determined during import:

1. Rules can specify direction
2. AI categorisation assigns direction alongside category
3. Transfers are detected by known patterns (e.g., credit card repayment, savings account transfers)

**Why this matters:**
- Transfers must not count in income/expense analytics
- Credit card repayments are not expenses
- Savings transfers should appear in savings tracking, not spending
- Refunds are income but contextually different from salary

## AI Integration

### 1. Batch categorisation (on import)

- Send ~50 transactions per request to gpt-4o-mini
- Prompt includes: allowed category list, existing rules as examples, raw descriptions
- **AI may only select from allowed categories** — it cannot create new ones
- AI may suggest new categories (logged for user review) but not apply them
- Response must be strict JSON, validated before acceptance

Required response schema:

```json
[
  {
    "index": 0,
    "merchantName": "Albert Heijn",
    "categoryId": 5,
    "direction": "expense",
    "isRecurring": false,
    "confidence": 0.82
  }
]
```

**Validation rules:**
- Response must be valid JSON array
- Each item must have all required fields
- `categoryId` must exist in allowed categories
- `direction` must be one of: income, expense, transfer
- `confidence` must be 0.0–1.0

**Error handling:**
- Malformed response → retry once
- Failed retry → transaction moved to Review queue with `categorisationMethod: "failed"`
- Rate limiting: max 3 concurrent requests, exponential backoff
- Request timeout: 30 seconds

### 2. Monthly summary (on demand)

- User clicks "Generate summary" on dashboard
- Send aggregated data to gpt-4o: category totals, month-over-month comparison, savings progress
- Returns plain-language narrative
- Tone: calm, practical, non-judgemental

### 3. Rule learning

- User confirms or corrects a category in Review → rule saved
- Next import checks rules first, only sends unknowns to AI
- Over time, AI calls shrink as rules grow

### AI Cost Controls

- **Cache**: categorisation results cached by raw description hash — same description never sent to AI twice
- **Rules first**: known merchants always use rules, never AI
- **Batch efficiently**: group unknowns into batches of ~50
- **Toggle**: AI can be disabled entirely via settings (app works without it)
- **Monthly cost target**: < $1–5/month for typical household

### Fallback

App works fully without an OpenAI key. Transactions remain uncategorised until manually categorised in Review.

## Confidence Scoring

Every categorisation carries a confidence score:

| Source | Score |
|--------|-------|
| Exact rule match | 1.0 |
| Contains rule match | 0.9 |
| Regex rule match | 0.85 |
| AI categorisation | AI-provided (typically 0.6–0.9) |
| Fallback/uncategorised | 0.0 |
| Manual assignment | 1.0 |

**Usage:**
- Review queue sorted by confidence (lowest first)
- Dashboard shows "confidence coverage" metric
- Low-confidence transactions flagged visually
- Threshold for "needs review": confidence < 0.7

## Data Model

### Categories (hierarchical)

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| name | text | e.g. "Groceries" |
| parentId | integer | nullable, FK to Categories.id |
| type | text | income, expense, transfer |
| sortOrder | integer | display ordering |
| isActive | integer | 0/1, soft delete |

Example hierarchy:

```
Food (parent)
├── Groceries
├── Dining
└── Coffee

Housing (parent)
├── Mortgage
├── Utilities
└── Insurance

Transport (parent)
├── Public Transport
├── Fuel
└── Parking

Income (parent, type=income)
├── Salary
├── Freelance
└── Refunds

Transfers (parent, type=transfer)
├── Savings
├── Investment
└── Credit Card Payment
```

### Transactions

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| sourceFileId | integer | FK to ImportFiles |
| transactionDate | text | YYYY-MM-DD |
| valueDate | text | YYYY-MM-DD |
| amount | real | absolute value |
| direction | text | income, expense, transfer |
| startBalance | real | |
| endBalance | real | |
| rawDescription | text | full bank description |
| merchantName | text | cleaned (e.g. "Albert Heijn") |
| categoryId | integer | FK to Categories |
| isRecurring | integer | 0/1 |
| fingerprint | text | for duplicate detection |
| confidence | real | 0.0–1.0 |
| categorisationMethod | text | ai, rule, manual, failed |
| isReviewed | integer | 0/1, user confirmed |
| createdAt | text | ISO timestamp |

### CategorisationRules

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| matchType | text | exact, contains, regex |
| matchValue | text | e.g. "Albert Heijn" |
| merchantName | text | cleaned output |
| categoryId | integer | FK to Categories |
| direction | text | income, expense, transfer |
| confidence | real | assigned score (1.0, 0.9, 0.85) |
| usageCount | integer | times rule has fired |

### ImportFiles

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| fileName | text | |
| importedAt | text | ISO timestamp |
| rowCount | integer | |
| duplicateCount | integer | |
| aiRequestCount | integer | |
| backupPath | text | path to pre-import backup |

### MonthlyBudgets

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| month | text | YYYY-MM |
| categoryId | integer | FK to Categories |
| budgetAmount | real | user-editable forecast |
| isFixed | integer | 0/1, recurring vs variable |

### MonthlyAggregates (materialised)

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| month | text | YYYY-MM |
| categoryId | integer | FK to Categories |
| income | real | sum of income transactions |
| expense | real | sum of expense transactions |
| transferOut | real | sum of outbound transfers |
| recurringAmount | real | sum of recurring transactions |
| transactionCount | integer | |
| lastRecalculatedAt | text | ISO timestamp |

### SavingsGoals

| Field | Type | Notes |
|-------|------|-------|
| id | integer | auto-increment |
| year | integer | |
| month | integer | 1-12 |
| investmentGoal | real | |
| investmentActual | real | |
| savingsGoal | real | |
| savingsActual | real | |

## Recalculation Engine

Any transaction modification triggers recalculation of affected aggregates.

**Triggers:**
- Transaction category changed
- Transaction direction changed
- Transaction merchant changed
- Transaction deleted
- Transaction merged
- Categorisation rule updated (affects all matching transactions)
- Import committed

**What gets recalculated:**
- MonthlyAggregates for affected month(s)
- Category totals (rolling up hierarchy)
- Recurring transaction detection
- Forecast projections for future months
- Dashboard metrics cache

**Implementation:**
- Recalculation is synchronous for single-transaction edits (fast, SQLite is local)
- Recalculation is batched for bulk operations (import, rule update)
- Each recalculation updates `lastRecalculatedAt` timestamp

## Categories

Initial hierarchy seeded from existing spreadsheet workflow:

**Expense categories:**
- Food → Groceries, Dining, Coffee
- Housing → Mortgage, Utilities, Insurance (Home)
- Transport → Public Transport, Fuel, Parking
- Health → Health Insurance, Fitness, Personal Care
- Children → Childcare
- Communication → Telecommunications
- Shopping → Online Shopping
- Leisure → Entertainment, Donation
- Finance → Miscellaneous

**Income categories:**
- Income → Salary, Freelance, Refunds

**Transfer categories:**
- Transfers → Savings, Investment, Credit Card Payment

New categories can only be added manually by the user. AI may suggest but never create.

## Core Views

### 1. Dashboard (home page)

Purpose: fast monthly financial understanding. Should answer in under 30 seconds: How much did we earn? How much did we spend? Are we saving enough? What changed? What needs attention?

Should feel like a monthly household overview, not an analytics tool.

**Layout: Dual-mode with toggle**

A tab/toggle at top-right switches between two views:
- **Overview mode** (default): Hero net cashflow metric (large, centred), supporting stats below (income, expenses, savings rate), full-width spending-by-category chart, change indicators at bottom. Answers "how are we doing?" in 5 seconds.
- **Detail mode**: Full cockpit layout. Metrics grid (4 cards), category chart + trend chart side by side, top merchants list, comparison to last month, confidence coverage. For deeper analysis.

Both modes share: month selector at top-left, toggle at top-right.

Features:
- Month selector (defaults to current month)
- Key metrics: total income, total expenses, net cashflow, savings rate
- Spending by category (bar chart) — **clickable for drilldown**
- Income vs expenses trend (line chart, last 6 months)
- Fixed vs variable breakdown
- Top merchants this month — **clickable for drilldown**
- Comparison to last month (up/down indicators)
- Confidence coverage metric (% of transactions at confidence > 0.7)
- "Generate AI summary" button

### 2. Import

Purpose: safe, reversible, transparent file import. The user should never fear importing a file.

**Layout: 3-step wizard**

Step indicator at top (1. Upload → 2. Preview → 3. Done). Each step replaces the previous content. Clear progression.

- Step 1: File drop zone (accepts .TAB and .XLS)
- Step 2: **Preview step** showing parsed rows, date range, duplicate count, rule-matched categories (with ~1000 seeded rules, most will be pre-categorised). Confirm/cancel buttons — never auto-import on upload.
- Step 3: Import summary showing rows imported, duplicates skipped, categories assigned, items sent to review. Link to Review for any remaining items.
- Processing progress indicator visible during confirm step
- Clear explanation of any parsing issues

### 3. Review

Purpose: efficient correction of AI mistakes. With ~1000 seeded rules from existing spreadsheet data, the review queue will typically be near-empty (only truly new merchants).

**Layout: Pure spreadsheet table**

Dense table with inline dropdowns. Category editable directly in the cell. Uncategorised rows highlighted with amber. Fastest possible correction workflow.

The queue should shrink over time as rules improve. Success metric: user spends less time reviewing every month. Empty state celebrates "All caught up!"

- Table columns: date, description, amount, category (inline dropdown), merchant (inline text edit), confidence, actions
- "Save as rule" button per row — creates categorisation rule from correction
- Bulk actions: checkbox select multiple, assign same category
- Filter: by month, by category, unreviewed only, by confidence threshold
- Minimise cognitive load: aggressively learn from corrections, reduce manual work over time

### 4. Forecast

Purpose: practical, realistic view of next month. Non-judgemental — avoid pretending forecasts are precise.

**Layout: Hero number + three editable columns**

The most important number — **"What remains after fixed costs?"** — displayed prominently at top (large, centred, with formula breakdown: income − fixed = remaining).

Below: three equal columns:
1. **Fixed costs** — list of recurring items with amounts (editable). Auto-populated from detected recurring transactions.
2. **Variable costs** — list of category estimates with amounts (editable). Auto-populated from rolling 3-month average.
3. **Savings & goals** — savings target, projected surplus, year-to-date progress.

Each line item is editable — user can override any projected amount. The hero "remaining" number recalculates live as values are edited.

- Next month view (month shown in header)
- Bottom line: projected income − projected expenses = projected surplus/deficit
- Signal: under/on budget = neutral, over budget = flagged
- Savings/investment goal progress (year-to-date vs target)

### 5. Login

- Simple login form (username + password)
- Credentials configured via environment variables
- JWT token stored in browser, required for all other pages

## Drilldown Navigation

All charts and aggregate metrics support drilldowns:

```
Dashboard
→ Click category (e.g. "Food")
→ See subcategory breakdown (Groceries, Dining, Coffee)
→ Click subcategory (e.g. "Groceries")
→ See merchant breakdown (Albert Heijn, Jumbo, Lidl)
→ Click merchant
→ See individual transactions
```

**Required drilldowns:**
- Parent category → child categories
- Child category → merchants in that category
- Merchant → individual transactions
- Month trend point → that month's category breakdown

**Implementation:**
- Drilldown is a navigation pattern, not a modal
- URL reflects drill state (e.g. `/dashboard?month=2026-05&category=5&merchant=albert-heijn`)
- Back button works naturally
- Breadcrumb trail shows drill path

## Authentication

- Single username/password configured via environment variables (not in code/git)
- Server validates credentials, issues JWT
- All API routes check JWT (middleware)
- Frontend shows Login page if no valid token
- No registration, no password reset, no multi-user

## Seed Data Import

One-time import of existing spreadsheet data ("Data+category" sheet, ~992 rows) to bootstrap the categorisation rules engine. Each unique merchant+category pair becomes a categorisation rule. This runs once at setup.

## Forecast Logic

- **Fixed costs:** auto-detected from recurring transactions (same merchant, similar amount, monthly cadence). Shown as committed spend for next month.
- **Variable costs:** rolling 3-month average per category. Shown as projected spend.
- **User overrides:** any category budget can be manually edited for a given month.
- **Signal:** under/on budget = neutral, over budget = flagged.

## Backup Strategy

- **Pre-import backup**: automatic SQLite snapshot before every import commit
- **Timestamped**: backups named `backup-YYYY-MM-DD-HHmmss.sqlite`
- **Location**: `data/backups/`
- **Retention**: keep last 10 backups, delete older ones
- **Manual**: user can trigger backup from settings

## Observability & Debug Logging

Server logs (structured JSON to stdout):

- Every import: file name, row count, duration, duplicates, AI calls made
- Parser failures: file name, row number, raw content
- Duplicate detection: fingerprints matched
- AI requests: batch size, latency, token usage, cost estimate
- AI failures: malformed responses (full response logged), timeouts, retries
- Categorisation statistics: rules hit, AI used, failed, manual needed
- Recalculation events: trigger, affected months, duration

**Debug mode** (enabled via env var):
- Store raw AI prompts and responses in `data/debug/ai/`
- Full import trace logs in `data/debug/imports/`

## UX & Experience Design

### Product Philosophy

The product should feel like a calm financial operating system for a family. Not a fintech startup app, not a stock trading platform, not a gamified budgeting app, not an accounting system.

Priorities: clarity, trust, calmness, practicality, low maintenance, explainability, long-term usability.

**Long-term UX goal:** Once a month, open the app for 10–15 minutes, understand the financial state of the family, make a few corrections if needed, and leave feeling informed rather than stressed.

### Core Principles

**1. Calm and understandable.** The UI reduces stress around money. Clean layouts, predictable interactions, clear hierarchy, readable tables, minimal visual noise. No bright aggressive colours, no flashing alerts, no gamification, no dopamine-style reward UX.

**2. Spreadsheet-friendly without spreadsheet friction.** Preserve: dense information layouts, keyboard-friendly interactions, fast scanning, tabular workflows. Remove: manual formulas, repetitive categorisation, broken references, copy/paste, maintenance overhead.

**3. Local-first feeling.** Fast, responsive, reliable, private. Interactions feel immediate because everything is local. No loading spinners everywhere, no network-dependent UX, no unnecessary async complexity.

**4. Explainability over "smartness".** Users always know: why a category was chosen, why something was flagged, why spending changed, where forecasts come from. The system feels transparent, inspectable, trustworthy. Never silently rewrite data, auto-create structures, or hide logic behind AI.

**5. Progressive complexity.** Beginner: simple monthly overview, key metrics, minimal setup. Advanced: drilldowns, forecasts, recurring analysis, merchant-level insights. Complexity emerges gradually.

### Visual Design

**Navigation:** Compact icon rail (no text labels). Dark background (#1c1917), icon-only, always visible. Maximises content width. Active page indicated by white icon background. Tooltip on hover shows page name.

**Colour System — Warm Stone & Paper:**
- Background: off-white `#fafaf9` (stone-50)
- Cards/surfaces: white `#ffffff` with `#e7e5e4` borders (stone-200)
- Sidebar rail: dark stone `#1c1917` (stone-950)
- Primary text: `#1c1917` (stone-950)
- Secondary text: `#78716c` (stone-500)
- Muted text: `#a8a29e` (stone-400)
- Positive: `#16a34a` (green-600)
- Warning/attention: `#f59e0b` (amber-500)
- Negative: `#dc2626` (red-600)
- Chart bars: stone spectrum (`#57534e`, `#78716c`, `#a8a29e`, `#d6d3d1`)
- Corners: slightly rounded (6-8px for cards, 4px for inputs)
- No accent colour — the palette is intentionally neutral

**Layout:** Dense but readable. Clear spacing hierarchy. Practical information density. Stable, consistent layouts. No oversized cards, no excessive whitespace, no trendy fintech aesthetics. Light mode only.

**Charts:** Explain trends quickly. Support drilldowns. Remain readable at small sizes. Use stone-spectrum colours (monochrome). No overly decorative charts, no excessive colour usage, no animation-heavy transitions. Charts are tools for understanding, not decoration.

**Tables:** Primary interaction model. Keyboard-friendly, sortable, filterable, fast to scan, sticky headers where useful. The product embraces tables instead of hiding them. Inline dropdowns for editing (spreadsheet-style).

### AI UX

AI should feel assistive, not autonomous. It suggests, explains, summarises, interprets. It never silently changes financial data, auto-creates categories, overwrites user decisions, or behaves unpredictably.

**AI tone for generated summaries:** Calm, practical, neutral, non-judgemental, concise. No hype language, no emotional manipulation, no financial shame.

Good: "Dining spending increased this month, mainly during the second half. Savings were slightly below target, while fixed costs remained stable."

Bad: "Warning! Your spending habits are getting out of control!"

### Empty States

The product should feel useful with no imports, incomplete categorisation, no OpenAI key, or partially configured budgets. Use onboarding hints, example states, lightweight explanations, progressive guidance. No blank screens, no overwhelming setup flows.

### Undo & Recoverability

Financial software should always feel reversible. Users can undo imports, revert categorisations, restore backups, cancel edits safely. The UI reduces fear of mistakes.

### Performance Targets

- Dashboard loads under 1 second
- Drilldowns feel immediate
- Import preview renders quickly
- Editing transactions feels responsive
- No perceptible latency for local operations

## Out of Scope (v1)

- Multi-account support
- Bank API connections
- Additional export formats (CSV/XLSX)
- Mobile app
- Cloud sync
- Multi-user
- Recurring transaction management UI
- Complex forecasting/ML predictions
- Investment trading features

## Deferred to v2

- Review queue prioritisation (smart sorting by confidence, value, novelty)
- Expanded forecast view (remaining disposable income, budget exceed warnings, savings trajectory)
- Improved authentication (bcrypt hashing, SQLite credential storage, first-run setup)
