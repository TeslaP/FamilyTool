# FamilyTool — Future Plans

## Next Up (Ready to Build)

### AI Reflection Redesign
- Replace simple "Generate summary" with a reflection flow
- Add intake field: "What are your goals this month?"
- AI generates a financial reflection based on goals + data
- Reflections stored as history (inform future reflections)
- Detail page gets separate data-driven analysis (no user prompt needed)
- System prompts refined for each context

### Calendar Fixes
- "Year to date" preset should be year-relative (past year = full Jan-Dec)
- Fix edge cases with range navigation + chevrons

### Monthly Phrases / Temporal Self-Awareness
- Each month gets a short AI-generated phrase capturing its feeling:
  - "January: A busy start, higher than usual"
  - "March: Settling into rhythm"
- Stored permanently as annotations
- Shown on trajectory page alongside spending data
- Shown when scrolling through months
- The product becomes: a journal of financial feelings

---

## Medium-Term

### Seed Data Bootstrapping
- Import existing spreadsheet's ~442 merchant→category pairs as rules
- Reduces AI calls to near-zero for known merchants
- One-time setup script

### Category Management UI
- Add/edit/reorder categories
- Merge categories
- Archive unused ones

### Settings Page
- AI toggle (enable/disable)
- Backup management (view/restore)
- Category editor
- Account preferences

### Recurring Transaction Detection
- Auto-flag monthly patterns
- Surface in forecast as committed costs
- Allow manual override

---

## Long-Term Vision

### Monthly Intentions
- Set monthly goals/themes: "reduce dining", "save €500"
- AI reflections reference these
- Year-end review of intention vs reality

### Annotations & Memory
- Add notes to individual months
- "What mattered this month" free-form entries
- Build a narrative over time

### Year-End Review
- Auto-generated yearly retrospective
- Savings trajectory
- Spending patterns
- Seasonal discoveries
- Intentions met/missed

### Desktop Packaging
- Electron or Tauri wrapper
- Menu bar quick-view
- Auto-start on login
- Native notifications for monthly check-in

### Multi-Account Support
- Multiple bank accounts
- Consolidated view
- Per-account import

### Optional Encrypted Backups
- Encrypted SQLite snapshots
- Cloud backup option (user-controlled)
- Restore from backup flow

---

## Product Philosophy (Guiding Future Work)

The product is evolving from **expense tracking** toward **temporal self-awareness**.

Three layers of awareness:
- **Reflection** (monthly) — "How did we do?"
- **Operational** (weekly) — "Where is this month heading?"
- **Longitudinal** (yearly) — "How is life evolving?"

Design principles for future features:
- Calm over efficient
- Reflective over analytical
- Observational over prescriptive
- Memory over metrics
- Stillness over motion

The ultimate goal: users open FamilyTool once a month, spend 10-15 minutes reflecting, and leave with a sense of understanding rather than anxiety.
