# FamilyTool — Family Finance Organiser

A local-first family financial operating system that replaces manual spreadsheet workflows. Imports ABN AMRO bank exports, categorises transactions using AI, tracks budgets and savings, and provides monthly financial visibility with drilldown analytics.

## Why

- Replace repetitive spreadsheet work with automation
- AI-assisted categorisation that learns from corrections
- Privacy-focused: all data stays local (SQLite)
- Monthly rhythm: understand your finances in under 15 minutes

## Architecture

```
FamilyTool/
├── client/           # React + Vite + Tailwind SPA
├── server/           # Express + TypeScript API
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   ├── db/       # SQLite schema & migrations
│   │   └── ai/       # OpenAI integration
│   └── tests/        # Vitest test suite
├── data/             # SQLite database + backups (gitignored)
└── samples/          # Test fixtures
```

**Stack:** React 18, TypeScript, Tailwind CSS, Express, better-sqlite3, OpenAI API, Recharts

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
# Clone
git clone https://github.com/TeslaP/FamilyTool.git
cd FamilyTool

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials (see Configuration below)

# Run
npm run dev
```

Server starts on `http://localhost:3001`, client on `http://localhost:5173`.

### Configuration

Create a `.env` file from `.env.example`:

```env
# Auth (required)
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password-here
JWT_SECRET=generate-a-random-string

# OpenAI (optional — app works without it)
OPENAI_API_KEY=sk-...

# Database
DB_PATH=./data/familytool.sqlite

# Debug
DEBUG_MODE=false
```

The app works fully without an OpenAI key — transactions just remain uncategorised until you manually categorise them.

## Features

### Import Pipeline

- Upload ABN AMRO `.TAB` or `.XLS` bank exports
- Preview before committing (see duplicates, estimated categories)
- Automatic duplicate detection (fingerprint-based)
- Pre-import database backup

### AI Categorisation

- Batch categorisation using gpt-4o-mini (~$0.01-0.03 per import)
- Strict validation: AI can only select from allowed categories
- Results cached to avoid repeat API calls
- Confidence scoring on every categorisation
- Graceful fallback when AI is unavailable

### Rule Learning

- Correct a transaction → save as a categorisation rule
- Rules are checked before AI on every import
- Over time, AI calls shrink as rules grow
- Three match types: exact, contains, regex

### Hierarchical Categories

```
Food
├── Groceries
├── Dining
└── Coffee

Housing
├── Mortgage
├── Utilities
└── Insurance
```

Income, expense, and transfer categories with rollup analytics.

### Recalculation Engine

- Monthly aggregates automatically maintained
- Any edit triggers recalculation of affected months
- Dashboard metrics always reflect current data

### Monthly Summary

- AI-generated plain-language narrative of your month
- Calm, practical, non-judgemental tone
- Compares to previous month

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List all categories (auth required) |
| POST | `/api/import/preview` | Upload file, get preview |
| POST | `/api/import/confirm` | Commit import to database |
| GET | `/api/transactions` | List transactions (filterable) |
| PATCH | `/api/transactions/:id` | Update transaction |
| POST | `/api/transactions/:id/create-rule` | Create rule from correction |
| POST | `/api/summary/generate` | Generate AI monthly summary |

All endpoints except `/api/auth/login` and `/api/health` require `Authorization: Bearer <token>` header.

## Testing

```bash
# Run all tests
npm test

# Run with watch mode
npm test -w server

# Run specific test file
npm test -w server -- --run parser
```

## Bank Export Formats

### ABN AMRO TAB

Tab-separated, no header, 8 fields. Uses comma as decimal separator (`1282,61`).

```
accountNumber  currency  transactionDate(YYYYMMDD)  startBalance  endBalance  valueDate(YYYYMMDD)  amount  description
```

### ABN AMRO XLS

Same data with header row and dot decimals. Columns: accountNumber, mutationcode, transactiondate, valuedate, startsaldo, endsaldo, amount, description.

## Transaction Direction

Every transaction has an explicit direction:
- **income** — salary, refunds, interest
- **expense** — purchases, bills, subscriptions
- **transfer** — between own accounts, credit card payments, savings moves

Transfers don't count in income/expense analytics.

## Backup Strategy

- Automatic SQLite snapshot before every import
- Timestamped: `backup-YYYY-MM-DD-HHmmss.sqlite`
- Keeps last 10 backups, deletes older ones
- Stored in `data/backups/`

## Development

```bash
# Start both server and client
npm run dev

# Server only
npm run dev -w server

# Client only
npm run dev -w client

# Build client for production
npm run build
```

## Project Status

- [x] Phase 1: Foundation (scaffolding, DB, auth, parsers, import pipeline)
- [ ] Phase 2: AI & Recalculation (categoriser, aggregates, summaries, rule learning)
- [ ] Phase 3: Frontend (dashboard, import UI, review queue, forecast)

## Design Docs

- [Design Spec](docs/superpowers/specs/2026-05-13-family-finance-organiser-design.md)
- [Phase 1 Plan](docs/superpowers/plans/2026-05-13-phase1-foundation.md)
- [Phase 2 Plan](docs/superpowers/plans/2026-05-14-phase2-ai-recalculation.md)

## License

Private project.
