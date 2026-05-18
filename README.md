# FamilyTool

A local-first financial organiser with an optional reflective layer.

FamilyTool combines practical transaction management — import, categorise, review, forecast — with a guided monthly reflection experience called **Horizon Sessions**.

The goal is not optimisation or budgeting pressure. The goal is financial self-awareness.

---

## Philosophy

Most finance software is designed around tracking, optimisation, and behavioural nudging. FamilyTool takes a different approach.

It treats financial review as a calm monthly practice:
- observational rather than judgemental
- reflective rather than reactive
- operational without feeling corporate

The product rhythm:

```
Import transactions
→ review what happened
→ reflect on the month
→ leave a note for the future
→ continue next month with memory and context
```

---

## Horizon Sessions

An optional guided reflection mode layered on top of the operational finance tool.

```
Dashboard → "Reflect on this month →"
→ Entry (greeting + intention)
→ Processing (settling in)
→ Notable transactions (grounding)
→ AI-generated reflection
→ Closing note
→ Return to dashboard
```

Sessions are calm, observational, non-judgemental. Not productivity coaching, not budgeting pressure, not wellness language.

The AI reflection references trends across months, previous session notes, and user intentions — creating financial memory over time.

---

## Features

### Local-first
- SQLite storage, data stays on your machine
- No cloud sync, works offline
- Pre-import backups

### Transaction Import
- `.TAB`, `.TXT`, `.XLS` bank exports (ABN AMRO format)
- Upload → Preview → Confirm wizard
- Duplicate detection, rule matching
- AI categorisation runs in background (child process)

### AI Categorisation
- OpenAI (gpt-4o-mini) with Dutch banking context
- Transfer detection (own accounts, credit cards, investments)
- Rule learning from corrections
- ~400 pre-seeded rules from historical data (90%+ auto-categorisation)
- Confidence scoring, cached results
- Graceful fallback without API key

### Dashboard
**Overview** — calm monthly reflection:
- Hero metric with count-up animation
- Temporal reflection (scope-adaptive note for the period)
- Category spending grid
- Session reflection display
- Entry point to Horizon Sessions

**Detail** — scrollable operational report:
- Monthly metrics
- Temporal reflection block (adapts depth to selected timeframe)
- Weekly pacing (runway awareness)
- Category + merchant breakdowns
- Year trajectory (savings progress, YoY spending)
- AI observations with category anomaly detection

### Weekly Pacing
Reframes budgeting as runway awareness. "How is this month unfolding?" rather than "You are over budget."

### Year Trajectory
Longitudinal view: savings progress, investment pacing, year-over-year spending. Designed to feel like an energy report, not a trading dashboard.

### Review
- Spreadsheet-style table with inline dropdowns
- Toggle: "Needs review" / "All transactions"
- Bulk assign, confirm, delete
- Save corrections as rules
- Review badge in sidebar

### Forecast
- Fixed vs variable cost projection
- Period selector: 1 month / 3 months / Till EOY
- Editable line items, live recalculation

### Calendar
- Month selector with dropdown grid + year navigation
- Presets: This month, Last month, Last 3/6 months, Year to date, Calendar year
- Range highlighting, chevrons navigate from range end
- Selection persists across pages (shared context)

---

## Visual Design

- **Palette:** Warm Stone & Paper (Tailwind `stone` scale, seasonal tint)
- **Typography:** Inter (UI) + Newsreader (reflection/editorial)
- **Navigation:** Compact icon rail with tooltips
- **Login:** Seasonal nature photography, staggered entrance animation
- **Motion:** Unified system — micro(200ms) / section(600ms) / atmospheric(1200ms)
- **Logo:** Horizon mark (circle with layered landscape lines)
- **Transitions:** 400ms blur threshold entering Session mode

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### Installation

```bash
git clone https://github.com/TeslaP/FamilyTool.git
cd FamilyTool
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password
JWT_SECRET=change-this

OPENAI_API_KEY=sk-...

DB_PATH=./data/familytool.sqlite

AI_MODEL=gpt-4o-mini
AI_SUMMARY_MODEL=gpt-4o-mini
```

OpenAI is optional. The app works without it — transactions remain uncategorised until manually reviewed.

### Restore Sample Data (optional)

Pre-categorised transactions (no API calls needed):

```bash
cd server && npx tsx restore-sample-db.ts
```

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## Architecture

```
FamilyTool/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── pages/          # Dashboard, Import, Review, Forecast, Session
│   │   ├── components/     # MonthSelector, Layout, HorizonLogo, etc.
│   │   ├── hooks/          # useAuth, useApi, useMonthParam, useCountUp
│   │   └── api/            # API client with JWT auth
├── server/                 # Express API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Parser, rules, recalculation, backup
│   │   ├── ai/             # Prompt registry, categoriser, validator, cache
│   │   └── db/             # SQLite schema, migrations
├── data/                   # SQLite database + backups + sample-db.json
└── docs/                   # Design specs, plans, future roadmap
```

Key architectural decisions:
- Prompt registry: separate prompts per purpose (categorise, reflect, analyse)
- AI import: detached child process (`categorise-pending.ts`)
- Session mode: orchestration layer, same data, different emotional container
- Month state: React context shared across pages

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List categories |
| POST | `/api/import/preview` | Preview import |
| POST | `/api/import/confirm` | Commit import |
| GET | `/api/import/status` | AI categorisation progress |
| GET | `/api/transactions` | List transactions |
| GET | `/api/transactions/pacing` | Weekly pacing data |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/:id/create-rule` | Create rule from correction |
| POST | `/api/session/reflect` | Generate session reflection |
| POST | `/api/session/save` | Save session |
| GET | `/api/session` | Get session history |
| GET | `/api/reflections/temporal` | Get cached temporal reflection |
| POST | `/api/reflections/temporal/generate` | Generate temporal reflection |
| GET | `/api/trajectory` | Year trajectory data |
| POST | `/api/summary/generate` | Generate AI summary |

---

## Development

```bash
# Full dev (client + server)
npm run dev

# Tests
npm test -w server

# Build client
npm run build -w client

# Type check
npx tsc --noEmit -p client/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json

# Run AI categorisation on pending transactions
cd server && npx tsx categorise-pending.ts

# Seed categorisation rules from spreadsheet data
cd server && npx tsx seed-rules.ts

# Restore sample DB (pre-categorised transactions)
cd server && npx tsx restore-sample-db.ts
```

---

## Design Documents

- [Main design spec](docs/superpowers/specs/2026-05-13-family-finance-organiser-design.md)
- [Design system (typography + colours)](docs/superpowers/specs/2026-05-14-design-system.md)
- [Dashboard evolution](docs/superpowers/specs/2026-05-14-dashboard-evolution-design.md)
- [Horizon Sessions MVP](docs/superpowers/specs/2026-05-16-horizon-sessions-mvp.md)
- [Future plans](docs/FUTURE.md)

---

## Status

Current focus:
- Horizon Sessions (contextual reflections, financial memory)
- Atmospheric UI refinement
- Local-first reliability

Deferred:
- Product rename (Horizon branding migration)
- Multi-user support
- Bank API sync
- Mobile app
- Cloud sync
- Desktop packaging

---

## License

AGPL-3.0. See [LICENSE](LICENSE).
