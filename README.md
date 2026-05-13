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
- Preview imports before committing
- Automatic duplicate detection
- Pre-import backups

## AI-Assisted Categorisation

- Categorises transactions using OpenAI models
- Learns from manual corrections
- Confidence scoring for every categorisation
- Falls back gracefully when AI is unavailable

## Budgeting & Forecasting

- Monthly spending overview
- Savings and investment tracking
- Fixed vs variable cost analysis
- Rolling forecast projections

## Drilldown Analytics

Navigate from:
- monthly overview
- → category breakdown
- → merchant breakdown
- → individual transactions

## Review Workflow

- Correct uncategorised transactions
- Save corrections as reusable rules
- Reduce manual work over time

---

# Product Philosophy

FamilyTool is designed to feel:

- calm
- practical
- local-first
- spreadsheet-friendly
- understandable

The system uses:
- deterministic calculations for financial data
- AI for categorisation, explanation, and summaries

The goal is to help users understand monthly finances in a few minutes rather than maintain large spreadsheet systems.

---

# Tech Stack

Frontend:
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

Backend:
- Express
- TypeScript
- SQLite (`better-sqlite3`)

AI:
- OpenAI API

---

# Project Structure

```text
FamilyTool/
├── client/              # React + Vite frontend
├── server/              # Express API + business logic
├── data/                # SQLite database + backups
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
git clone <repo-url>
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

# Debugging
DEBUG_MODE=false
```

OpenAI is optional. The app works without it, but uncategorised transactions must be reviewed manually.

## Run Development Environment

```bash
npm run dev
```

Frontend:
- http://localhost:5173

Backend:
- http://localhost:3001

---

# Import Flow

```text
Upload file
→ Preview transactions
→ Detect duplicates
→ Estimate categories
→ Confirm import
→ Review unknown transactions
```

Supported formats:
- `.TAB`
- `.TXT`
- `.XLS`

Additional formats may be added later.

---

# AI Features

## Categorisation

Unknown transactions are grouped into batches and categorised using OpenAI models.

The system:
- validates all AI responses
- restricts AI to allowed categories
- caches categorisation results
- learns from manual corrections

## Monthly Summaries

Generate plain-language monthly financial summaries, including:
- spending changes
- savings progress
- unusual categories
- month-over-month comparisons

Tone is intentionally:
- calm
- practical
- non-judgemental

---

# Security & Privacy

- Backend runs locally
- OpenAI keys remain server-side
- Database stored locally
- Automatic backups before imports
- Debug logging disabled by default

Recommended:
- use a strong password
- keep `.env` private
- exclude `/data` from backups/sync services if desired

---

# API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/health` | Health check |
| POST | `/api/import/preview` | Preview import |
| POST | `/api/import/confirm` | Commit import |
| GET | `/api/transactions` | List transactions |
| PATCH | `/api/transactions/:id` | Update transaction |
| POST | `/api/summary/generate` | Generate AI summary |

---

# Development

## Run all tests

```bash
npm test
```

## Run backend tests

```bash
npm test -w server
```

## Start frontend only

```bash
npm run dev -w client
```

## Start backend only

```bash
npm run dev -w server
```

---

# Roadmap

## V1
- transaction imports
- categorisation
- review queue
- dashboard
- forecasting
- AI summaries

## Future
- additional import formats
- improved forecasting
- multi-account support
- desktop packaging
- optional encrypted backups

---

# License

Private project.
