# Dashboard Evolution — Weekly Pacing + Year Trajectory

## Three-Layer Mental Model

| Layer | Page | Question it answers | Tone |
|-------|------|-------------------|------|
| Reflection | Overview | "How did we do this month?" | Calm, monthly, journaling |
| Operational | Weekly Pacing | "Where is this month heading?" | Runway, cadence, awareness |
| Longitudinal | Trajectory | "How is the year evolving?" | Observational, seasonal, patterns |

This model should influence all future features.

---

## 1. Weekly Pacing View

### Access
Click the hero number on Dashboard Overview → `/pacing?month=2025-02`

### Layout (single viewport, calm, journaling-like)

```
← February 2025

         Remaining after week 4
              € 275,45

    At current pace, projected month-end: €275 remaining
                     stable

    Week 1 · €3,200 spent · €9,762 left
    Week 2 · €2,800 spent · €6,962 left
    Week 3 · €3,100 spent · €3,862 left
    Week 4 · €3,400 spent · €275 left          ·

         Reflect on this month →
```

### Design principles
- NOT budgeting software — runway/pacing feel
- No tables. Just lightweight text lines.
- Subtle dot or small neutral bar beside each week (tiny, decorative)
- Calm and spacious — lots of whitespace
- Current week has a subtle indicator (dot, not highlight)
- Journaling-like tone

### Projected runway
Below the hero, show:
- "At current pace, projected month-end: €X remaining"
- Status word: **stable** / **tightening** / **improving** (based on week-over-week spending trend)
- NOT red/green — neutral stone tones with maybe amber for "tightening"

### Data
- Weeks: Mon-Sun (ISO), split the month into 4-5 week segments
- Income counted when it arrives (by transaction date)
- Remaining = cumulative income to date - cumulative expenses to date
- Projection = remaining - (average daily spend × days left in month)

---

## 2. Trajectory Page

### Access
New sidebar icon (after Dashboard). Uses a calm icon — `Activity` or custom.

### URL
`/trajectory`

### Layout (single viewport initially, scroll for second chart)

```
Trajectory — 2025                              < 2025 >

┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Savings/Investment line chart — primary]           │
│  Goal (dashed) vs Actual (solid), 12 months         │
│                                                     │
│  Investment: ████████░░░░ €21,181 / €25,000         │
│  Savings:    █████████░░░ €9,788 / €10,000          │
│                                                     │
└─────────────────────────────────────────────────────┘

         This year so far
         "Savings on track. Spending peaked in January,
          stabilising since March."

─── below fold ───────────────────────────────────────

┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Monthly spending — bar chart, YoY]                │
│  2025 (stone-600) with 2024 muted behind (stone-200)│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Design principles
- ONE primary chart visible immediately (savings/investment)
- Second chart below fold (spending YoY)
- Lots of whitespace between sections
- Observation card beside or below the primary chart
- Charts are observational, not analytical — "seasonality of life"
- NO: stock trading vibes, KPI dashboards, fintech growth charts

### Chart style
- Recharts with stone-spectrum colours
- Goal line: dashed, stone-300
- Actual line: solid, stone-700
- YoY comparison bars: current year stone-600, previous year stone-200 (muted behind)
- Minimal grid lines, clean labels

### Observations section
Call it: "This year so far" or "Patterns this year"
- NOT: "AI insights", "recommendations", "intelligence"
- Tone: calm observation, like a journal entry
- Initially static (calculated from data: "spending peaked in X, savings on track")
- Future: AI-generated reflection

### Distinction from Forecast
- **Forecast** = future projection ("what will next month look like?")
- **Trajectory** = historical evolution ("how has the year unfolded?")
- Make this explicit in navigation tooltips

---

## Implementation Tasks

### Task 1: Seed savings goals + API endpoints
- Parse spreadsheet Savings sheet → insert into savings_goals table
- `GET /api/pacing?month=YYYY-MM` — weekly breakdown with cumulative remaining
- `GET /api/trajectory?year=YYYY` — monthly totals + savings goals + previous year

### Task 2: Weekly Pacing page
- New route `/pacing`
- New page component
- Hero remaining, projected runway, weekly list
- Back link to dashboard
- Calm, spacious, journaling layout

### Task 3: Trajectory page
- New route `/trajectory`
- New sidebar icon (between Dashboard and Import? Or after Forecast?)
- Savings line chart with progress bars
- Monthly spending bar chart with YoY comparison
- "This year so far" observation section

### Task 4: Connect Dashboard hero
- Hero number becomes clickable → `/pacing?month=...`
- Subtle hover effect (cursor pointer, slight opacity change)

### Task 5: Update sidebar
- Add Trajectory icon with tooltip
- Position: after Dashboard, before Import

---

## Out of scope (future)
- Recurring goals / yearly themes
- Monthly intentions / annotations
- "What mattered this month"
- AI-generated observations (use static calculations for now)
