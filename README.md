# ALLSTAR Executive Ops

Private executive operations command center for the Executive Assistant to Wylie at Allstar Life Group.

**Getting it online:** see [SETUP.md](SETUP.md).

## What's in Phase 1

| Area | What works |
|---|---|
| Home (“The Bridge”) | Landing page after sign-in: Central Time greeting with your chosen name (Settings → Home page), a fresh captain’s line on every visit from `lib/lines.ts`, live counts for due today / waiting / overdue, and a jump into the Command Center or My Day |
| Command Center | Five-question strip (today, overdue/urgent, waiting on, coming up, done), top three, due & overdue, needs-a-date, waiting-on summary, operational status by department, quick actions |
| My Day | Central Time blocks with live "now", per-block timers, mark done, progress, protected breaks, editable blocks (time, name, which departments' tasks appear), interruptions log, move unfinished to tomorrow |
| Tasks | Today / Tomorrow / This week / Overdue / No date / Waiting / Needs confirmation / All / Completed, department filter, full editor, activity history, weekly recurrence rolls forward on completion |
| Waiting On | Grouped by person (Wylie first); requested, follow-up date, impact if delayed; one-click "followed up" |
| Projects | Status, priority, next action, dependencies, deadline, linked tasks, update log |
| Notes & Preferences | Typed notes with pinning; Wylie's preferences split into permanent vs. temporary rules |
| Daily Recap | Generated only from stored records; short update for Wylie and detailed internal version; edit, copy, save, history |
| Search, quick add | `/` focuses search across tasks, projects, notes and preferences; `N` opens quick add anywhere |

Phase 2 and 3 modules (Recruiting, Calendar, Finance, Debt, Leads, Advertising, Office, Communications, AI Assistant) appear in the sidebar with their planned scope. **Their tables already exist** (see `supabase/migrations/0001_schema.sql`) and some are seeded (proposed recruiting availability, Jonathan's debt record, accounts needing reconnection, two lead groups), so building those screens won't require moving data.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase: Postgres, auth, row-level security
- Design tokens as CSS variables in `app/globals.css` (light + dark), mapped into Tailwind for new components
- Allstar mark as an inline vector (`components/Logo.tsx`), traced from the supplied artwork

## Security model

- Every page except `/login` requires a session (`middleware.ts`).
- Every table has `owner_id` defaulting to `auth.uid()` and an RLS policy restricting all reads and writes to the owner (`0002_security.sql`). Anonymous access is revoked.
- Only the public anon key ships to the browser; no service-role key is used anywhere.
- No banking credentials are stored. `financial_accounts` tracks connection status and an optional last-4 only.
- Writes report failure honestly: the UI only shows "Saved" after the database confirms.
- Unknown amounts, owners and deadlines are stored as `null` with a `needs_confirmation` list rather than guessed.

To add teammates later: add a `workspace_members` table and widen the RLS policies from `owner_id = auth.uid()` to workspace membership. Table shapes don't change.

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:3000
npm run typecheck
```

## Database

- `supabase/migrations/0001_schema.sql`: all tables, including Phase 2/3
- `supabase/migrations/0002_security.sql`: RLS, profile trigger
- `supabase/migrations/0003_seed.sql`: `seed_starting_items()`, called once by the app on first sign-in
- `supabase/migrations/0004_home.sql`: the home page name
- `supabase/setup.sql`: all of the above combined, for pasting into the SQL Editor

## Roadmap

- **Phase 2:** Recruiting (pipeline, manager stacking, availability builder), Wylie's calendar & scheduling queue, Finance (KPA queue, QuickBooks checklist, payables, rent), Debt (ledger, plans, payments), ATM program & weekly lead readiness, Advertising, Office, weekly recap.
- **Phase 3:** AI assistant (Claude API, server-side, with confirmation for money/messages/deletions/calendar and a full audit log in `ai_activity_log`), Google Calendar and Gmail integrations, automation engine (`automation_rules`, de-duplicated by `last_generated_for`).
