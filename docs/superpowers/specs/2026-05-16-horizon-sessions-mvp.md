# Horizon Sessions — MVP Build Spec

## What This Is

A guided financial reflection flow that creates a temporary reflective environment on top of the existing finance tool. 4 screens, one flow, optional entry.

## Success Criteria

"Did this make finance feel different?"

Not: beautiful UI. Not: feature completeness. The emotional pacing and AI writing quality are what matter.

---

## Flow

```
[Dashboard: "Reflect on this month →"]
    ↓ fullscreen takeover (fade + blur transition)
[1. Entry] — greeting, optional intention, "Begin"
    ↓
[2. Processing] — Horizon logo, rotating messages, 8-60s
    ↓ (AI runs during this time)
[3. Reflection] — structured AI narrative, full screen
    ↓
[4. Closing] — "Anything to remember?" + "Done"
    ↓ soft fade back
[Dashboard]
```

---

## Screen 1: Session Entry

**Layout:** Fullscreen. No sidebar, no nav, no app chrome.

**Background:** Soft gradient (same warmth as login) or very subtle atmospheric space.

**Content (centred):**
```
[Horizon logo — static, not animated]

Good evening                          ← time-aware greeting
A moment to review this month

[Optional: "What's on your mind?" — single text input, not required]

                Begin →
```

**Design:**
- Calm, spacious, minimal
- Input is optional — can skip straight to Begin
- The intention text is stored but not prominently framed
- No timer selection (MVP)
- No sound selector (MVP)

---

## Screen 2: Processing State

**This is the emotional core.** Not loading — settling in.

**Layout:** Fullscreen. Atmospheric.

**Background:** Very soft, almost-empty space. Subtle gradient or blurred landscape at low opacity.

**Centre:**
- Animated Horizon logo (draw mode → breathe)
- Rotating text below, changing every 4-6 seconds

**Messages (rotate):**
```
Looking through this month
Organising your spending
Finding recurring patterns
Preparing your reflection
Gathering context
Looking at pacing over time
```

**Avoid these words:** analysing, computing, generating, processing, AI

**Timing logic:**
- Minimum hold: 8 seconds (even if AI responds in 2s)
- Maximum: however long AI actually takes
- No progress bar. No percentages. No step indicators.

**What happens behind the scenes:**
- Call `/api/summary/generate` with enhanced system prompt
- Pass: month data, intention text, previous session notes (if any)
- Wait for response, then hold until minimum time elapsed

---

## Screen 3: AI Reflection

**Layout:** Fullscreen. Clean reading experience.

**Structure (4 sections, always in this order):**

**1. What happened** — objective observations
> "Spending increased in travel and family-related categories this month, while groceries and housing remained relatively stable."

**2. Pacing** — temporal awareness
> "Most discretionary spending happened in the first half of the month, while the final weeks became more restrained."

**3. Context** — connects to intention (if provided)
> "You mentioned wanting to feel more in control. This month showed more consistency toward the end."

**4. Gentle closing** — framing, NOT advice
> "Overall, this month feels active but stabilising — with clearer spending patterns emerging over time."

**Design:**
- Newsreader (editorial) font for the reflection text
- Generous line-height (1.7+)
- Max-width for comfortable reading (~600px)
- Sections separated by whitespace, not headers
- Calm, like reading a short essay
- "Continue →" button at bottom

**AI System Prompt (critical):**
- Tone: calm observer, not coach/advisor/therapist
- Structure: always 4 sections (what happened, pacing, context, closing)
- Length: 4-6 sentences total (NOT long)
- Never use: "you should", "try to", "I recommend", "great job"
- Never: exclamation marks, motivational language
- Reference intention naturally if provided, don't force it

---

## Screen 4: Closing

**Layout:** Fullscreen. Minimal.

**Content:**
```
[Horizon logo — static]

Anything to remember about this month?

[Text area — optional, 2-3 lines max]

                    Done
```

**On "Done":**
- Save: intention, AI reflection, closing note, timestamp, month
- Soft fade transition back to dashboard
- No celebration. No "Session complete!" No badges.

---

## Technical Implementation

### Route
`/session` — renders outside the Layout shell (no sidebar)

### New server endpoint
`POST /api/session/reflect` — enhanced version of summary/generate:
- Accepts: `{ month, intention?, previousNotes? }`
- Returns: `{ reflection: string }` (structured 4-section text)
- Uses richer system prompt than the basic summary

### New database table
```sql
CREATE TABLE IF NOT EXISTS session_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  intention TEXT,
  aiReflection TEXT NOT NULL,
  closingNote TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### New client components
- `client/src/pages/Session.tsx` — manages the 4-step flow
- No new shared components needed (reuse HorizonLogoAnimated, etc.)

### Entry point
- Dashboard "Reflect on this month →" button navigates to `/session?month=YYYY-MM`
- The transition: current screen fades out → session fades in (handled by route change + animate-atmospheric class)

---

## What This Does NOT Include (deferred)

- Timer/duration selection
- Ambient sounds
- Emotional markers on transactions
- Session history browsing UI
- Previous session context fed to AI
- Guided prompts / multi-step reflection
- Push notifications
- Streak/engagement systems

---

## Language Rules

**Use:** reflection, review, session, pacing, monthly check-in, intention, overview

**Never use:** mindfulness, meditation, wellness, therapy, healing, coaching, optimise

---

## Build Order

1. Database table + API endpoint (server)
2. Session page component (4 steps as state machine)
3. Processing state (logo animation + rotating messages + timed hold)
4. AI system prompt (structured 4-section reflection)
5. Entry/exit transitions (fullscreen takeover from dashboard)
6. Wire up: dashboard "Reflect" → session → save → return
