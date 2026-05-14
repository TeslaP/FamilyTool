# FamilyTool

A local-first financial organiser for importing transaction exports, categorising spending, tracking budgets and savings, and understanding monthly financial trends.

Built for people who currently manage finances in spreadsheets and want a calmer, more automated workflow without relying on cloud-based finance platforms.

---

# Features

## Local-first

- SQLite-based local storage
- Financial data stays on your machine
- No cloud sync required
- Works offline

## Transaction Import

- Import `.TAB`, `.TXT`, and `.XLS` transaction exports
- 3-step wizard: Upload → Preview → Done
- Automatic duplicate detection
- Pre-import backups
- AI categorisation on import (with OpenAI)

## AI-Assisted Categorisation

- Categorises transactions using OpenAI (gpt-4o-mini)
- Dutch banking context (ABN AMRO formats, SEPA, BEA, iDEAL)
- Transfer detection (family accounts, credit card payments, investments)
- Learns from manual corrections → rules engine grows over time
- Confidence scoring for every categorisation
- Falls back gracefully when AI is unavailable

## Dashboard

Two modes on a single page:

**Overview** — calm monthly reflection:
- Hero metric: "Available in [Month]" with large amount
- Category spending grid (clickable for drilldowns)
- "Reflect on this month" AI prompt

**Detail** — scrollable report:
- Monthly metrics (income, expenses, net, savings rate)
- Weekly pacing (remaining per week, projected month-end, trend)
- Category breakdown grid
- Top merchants
- Year trajectory (savings progress + YoY spending comparison)
- AI observations

## Weekly Pacing

- Breaks month into weeks showing cumulative remaining
- Projected month-end based on current pace
- Trend indicator: stable / tightening / improving
- Feels like runway awareness, not budget pressure

## Year Trajectory

- Savings & investment goal vs actual (progress bars)
- Monthly spending year-over-year bar chart
- Calm, observational tone (like an energy report)

## Forecasting

- Fixed vs variable cost projection
- Period selector: 1 month / 3 months / Till end of year
- Editable line items with live recalculation
- Hero: "Remaining after fixed costs"

## Review Workflow

- Spreadsheet-style table with inline dropdowns
- Toggle: "Needs review" / "All transactions"
- Bulk assign, confirm, delete
- Save corrections as reusable rules
- Review badge in sidebar shows pending count
- Calm confirmation modals

## Drilldown Analytics

Navigate from:
- monthly overview
- → parent category
- → child category / merchants
- → individual transactions

With breadcrumb navigation and back button support.

## Calendar / Period Selection

- Month selector with dropdown grid
- Year navigation
- Presets: This month, Last month, Last 3/6 months, Year to date
- Range highlighting in month grid
- Selection persists across pages (shared context)

---

# Product Philosophy

FamilyTool is designed to feel like a calm monthly reflection space — not a fintech dashboard.

Three layers of awareness:

| Layer | View | Question |
|-------|------|----------|
| Reflection | Overview | "How did we do this month?" |
| Operational | Detail (weekly pacing) | "Where is this month heading?" |
| Longitudinal | Detail (trajectory) | "How is the year evolving?" |

The system uses:
- deterministic calculations for financial data
- AI for categorisation, explanation, and summaries

The goal: open the app for 10–15 minutes once a month, understand the financial state of the family, make a few corrections, and leave feeling informed rather than stressed.

---

# Visual Design

- **Typography:** Inter (UI) + Newsreader (editorial/reflective text)
- **Palette:** Warm Stone & Paper (Tailwind `stone` scale)
- **Navigation:** Compact icon rail (60px) with tooltips
- **Login:** Full-screen nature backdrop with rotating images
- **Charts:** Monochrome stone spectrum, observational not analytical
- **Radius:** 20px cards, 14px inputs/buttons
- **Logo:** Horizon mark (circle with layered landscape lines)

---

# Tech Stack

Frontend:
- React 18
- TypeScript
- Tailwind CSS
- Recharts
- Vite

Backend:
- Express
- TypeScript
- SQLite (`better-sqlite3`)

AI:
- OpenAI API (gpt-4o-mini for categorisation, gpt-4o-mini for summaries)

---

# Project Structure

```text
FamilyTool/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── pages/       # Dashboard, Import, Review, Forecast
│   │   ├── components/  # MonthSelector, Layout, MetricCard, etc.
│   │   ├── hooks/       # useAuth, useApi, useMonthParam
│   │   ├── api/         # API client with JWT auth
│   │   └── types/       # Shared TypeScript interfaces
├── server/              # Express API + business logic
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Parser, rules, recalculation, backup
│   │   ├── ai/          # OpenAI categoriser, validator, cache, prompts
│   │   └── db/          # SQLite schema, migrations
├── data/                # SQLite database + backups + sample-db.json
├── samples/             # Import test fixtures
└── docs/                # Design specs and plans
```

---

# Quick Start

## Prerequisites

- Node.js 20+
- npm 9+

## Installation

```bash
git clone https://github.com/TeslaP/FamilyTool.git
cd FamilyTool
npm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Authentication
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password
JWT_SECRET=change-this

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# Database
DB_PATH=./data/familytool.sqlite

# AI Models
AI_MODEL=gpt-4o-mini
AI_SUMMARY_MODEL=gpt-4o-mini
```

OpenAI is optional. The app works without it, but uncategorised transactions must be reviewed manually.

## Restore Sample Data (optional)

Pre-categorised transactions from Feb–Jul 2025 (no API calls needed):

```bash
cd server && npx tsx restore-sample-db.ts
```

## Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

# Import Flow

```text
Upload file
→ Preview (row count, duplicates, rule matches)
→ Confirm
→ AI categorises unknowns
→ Results summary
→ Review remaining items
```

Supported formats: `.TAB`, `.TXT`, `.XLS`

---

# AI Features

## Categorisation

- Batches of ~50 transactions sent to gpt-4o-mini
- Dutch banking context in system prompt (ABN AMRO, SEPA, BEA, iDEAL)
- Transfer detection (own accounts, investments)
- Strict JSON validation with retry
- Results cached by description hash
- Rules checked first — AI only called for unknowns

## Monthly Reflections

- Calm, observational financial summaries
- Tone: non-judgemental, practical
- Generated on demand ("Reflect on this month →")

---

# Security & Privacy

- All data stored locally (SQLite)
- OpenAI keys remain server-side
- Automatic backups before every import
- JWT authentication (single user)
- Debug logging disabled by default

---

# API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List categories |
| POST | `/api/import/preview` | Preview import |
| POST | `/api/import/confirm` | Commit import |
| GET | `/api/transactions` | List transactions |
| GET | `/api/transactions/pacing` | Weekly pacing data |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/:id/create-rule` | Create rule from correction |
| POST | `/api/summary/generate` | Generate AI summary |
| GET | `/api/trajectory` | Year trajectory data |
| GET | `/api/savings-goals` | Savings goals |

---

# Development

```bash
# Full dev (both client + server)
npm run dev

# Tests
npm test -w server

# Build client
npm run build -w client

# Type check
npx tsc --noEmit -p client/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json
```

---

# Design Documents

- [Main design spec](docs/superpowers/specs/2026-05-13-family-finance-organiser-design.md)
- [Design system (typography + colours)](docs/superpowers/specs/2026-05-14-design-system.md)
- [Dashboard evolution (weekly pacing + trajectory)](docs/superpowers/specs/2026-05-14-dashboard-evolution-design.md)
- [Future plans](docs/FUTURE.md)

---

# License

Private project.
