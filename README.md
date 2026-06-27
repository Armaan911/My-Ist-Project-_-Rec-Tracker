# Recruit Tracker

Runs identically on a **local Supabase stack** (for testing) and on **hosted Supabase + Vercel**.
Same code, same SQL — only the env vars differ.

---

## A) Run locally (Supabase CLI, fully offline)

Prereqs: Docker Desktop + Supabase CLI (`npm i -g supabase`).

```bash
supabase start          # boots local Postgres + Auth in Docker, applies migrations + seed.sql
cp .env.local.example .env.local
npm install
npm run dev             # http://localhost:3000
```

`supabase start` auto-applies the single file `supabase/database.sql` (tables + RLS + the 3 demo
accounts). If it prints anon/service keys that differ from `.env.local.example`, paste the printed ones in.

Local notes:
- Studio (DB UI): http://127.0.0.1:54323 · Email catcher (reset mails): http://127.0.0.1:54324
- Daily-form links + alert emails have no Resend key, so they **print to the `npm run dev` terminal**.
- Crons don't auto-fire locally — trigger by hand:
  `curl -H "Authorization: Bearer local-dev-secret" http://localhost:3000/api/cron/snapshot`
- Re-apply a clean DB any time: `supabase db reset` (re-runs migrations + seed).

## B) Deploy to cloud (hosted Supabase + Vercel)

1. Create a Supabase project, open the SQL editor, and run **`supabase/database.sql`** (one file:
   tables + security + demo accounts). That's the whole database.
   (CLI alternative: `supabase link --project-ref <ref>` then `supabase db push`.)
2. Import the repo into Vercel. Set env vars (Settings → Environment Variables):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, and optionally `GEMINI_API_KEY`, `RESEND_API_KEY`, `DAILY_FROM_EMAIL`.
3. Deploy. The crons in `vercel.json` run on schedule (daily form at 03:00 IST, etc.).

Your entire database is **one file: `supabase/database.sql`** — run it in any SQL editor. The CLI
applies the same file automatically (it's mirrored as the single migration). To remove demo accounts
for production, delete Section 3 at the bottom of that file.

Demo logins (change before production): admin@demo.com / Admin@12345 · manager@demo.com / Manager@12345 ·
recruiter@demo.com / Recruiter@12345

---

## What's built
- Auth (email + password) with **TOTP 2FA** step on login (Supabase MFA).
- Recruiter dashboard: reqs allocated today, submissions, all-time closures, target.
- Daily activity form (resumes sourced / applicants parsed / notes).
- Submissions with the full **status lifecycle** — change a submission's status any time
  (past or present); that's how closures get recorded.
- **Past-day edits are locked** → automatically filed as a `change_request` for admin approval.
- **Daily email flow**: a Vercel Cron at **3:00 AM IST** generates a single-use, 20h-expiry
  token per recruiter and emails a no-login form link.

## Built — Slice 2 (Manager dashboard)
- Team dashboard at `/manager` (admin + managers only; recruiters are redirected).
- Simple vs Detailed toggle.
- Charts: pipeline funnel, closures-by-recruiter (best=green / worst=red), 8-week trend.
- Leaderboard (this month) with medals (from `medal_tiers`, by all-time closures).
- Performer of week/month/year cards (read from finalized `performance_snapshots`).
- Alerts feed with mark-as-read.
- Cron `generate-alerts`: rule-based flagging (falling behind / target at risk) from
  `app_settings.falling_behind` + per-recruiter target. (Plain-English AI summaries = next slice.)
- Cron `snapshot`: on a week/month/year boundary, finalizes that period's standings into
  `performance_snapshots` (idempotent — once written it won't be overwritten, so winners never drift).

## Built — Slice 3 (Admin module) — at `/admin` (admin only)
- **Accounts**: create users (server-side via service role, so no insecure client signup),
  set role / division / submission target / active.
- **Requirements & allocation**: add clients, create requirements, and **allocate a
  requirement to a recruiter for a given date** — this is what fills a recruiter's
  "reqs allocated today". (Previously only possible via raw SQL.)
- **Approvals**: review pending past-day edits; Approve applies the change (admin can write
  locked rows) or Reject.
- **Config**: add/edit pipeline **stages** (incl. which count as closure), edit **medal
  tiers** (thresholds + colors), edit the **"falling behind" rule**.

## Built — Slice 4 (AI layer, Gemini)
- "AI weekly summary" card on the manager dashboard: a plain-English read on the week's
  flow, who's doing well, who's behind, plus one suggestion. Generated on demand (button,
  to avoid cost on every load). Server-side; respects the caller's RLS scope.
- Set `GEMINI_API_KEY` in env. Model `gemini-1.5-flash` (configurable in `lib/gemini.ts`).

## Built — Slice 5 (Security & accountability)
- **2FA enrollment** at `/security` (any user): scan QR, verify, turn TOTP on/off. Login already
  enforces the code once enrolled — the loop is now complete.
- **Audit logging**: admin actions (account create/update, requirement & allocation create,
  approve/reject, config edits) are written to `audit_log`, viewable at **Admin → Audit log**.
  (Submission status changes were already tracked in `submission_status_history`.)

## Built — Slice 6 (final feature pass)
- Requirements: **edit & delete**, and **view/add/remove allocations** per day (allocation chips with ×).
- **Forgot-password** (`/forgot`) + **reset** (`/reset`) flow; "Forgot password?" link on login.
- **Medal showcase** on the recruiter dashboard: current medal, progress bar to the next tier, all tiers.
- **Alert emails**: the generate-alerts cron now emails active admins when new alerts are raised
  (needs RESEND_API_KEY; otherwise logged).
- Recruiters can **rename or delete** their own submissions (RLS allows own-only delete).

## Built — Slice 7 (manager feature pack)
Run the migration `supabase/migrations/20260619000000_manager_features.sql` (or re-run `database.sql`).
- **Priority dropdown** on requirements (High / Medium / Low) instead of free text.
- Recruiter daily update: **requirement dropdown** ("what you worked on") sourced from today's allocations.
- **Manager "My day"** (`/dashboard` for managers): desk overview — requirement status counts, submission
  pipeline cards, this-week performance, new requirements, unallocated open reqs, team-activity-today,
  AI summary, alerts — instead of the recruiter logging form.
- **Managers now oversee ALL divisions.** The `Domestic` division is renamed **Internal Hiring**. The Team
  dashboard gets per-division tabs (**Overall / US IT / India IT / Internal Hiring**). Manager pages read
  via the service-role client (role-gated in code), so RLS stays untouched for recruiters/admins.
- **Requirement creation is admin-only.** Managers can allocate any requirement to **any recruiter**
  (cross-division) but cannot create or delete requirements.
- **Message recruiters**: composer on the manager Requirements & allocation page — send to everyone or
  selected recruiters. Delivered **in-app** (recruiter dashboard inbox) **and by email**.
- **Outlook reply-by-email daily updates** (optional): when `MS_*` / `OUTLOOK_*` env vars are set, the daily
  email is sent via Microsoft Graph from the monitored mailbox. Recruiters **reply** with their numbers
  (e.g. `Resumes: 12, Parsed: 30, Worked on: …`) and `/api/webhooks/outlook` parses the reply into
  `daily_activity`. The web form remains as a fallback.
  - Azure AD app needs **application** permissions `Mail.Send` + `Mail.Read` (admin-consented).
  - `/api/cron/outlook-subscribe` (daily cron) creates/renews the Graph Inbox subscription.
  - Locked past-days route the emailed edit into the change-request approval queue, same as the form.

## Built — Slice 8 (achievements, analytics, richer data)
Run `supabase/migrations/20260619010000_badges.sql` then `..._20260619020000_candidate_and_daily_fields.sql`.
- **Recruiter Achievement & Badge System** — `badges` (admin-configurable) + `recruiter_badges` (awards).
  - 12-badge catalog seeded (First Submission, Week Starter, High Five, Double Digits, Top Submitter,
    First/Placement Star, Quality Recruiter, Consistent Recruiter, Status Champion, Hat Trick, Recruiter of
    the Month). Admin tunes name/icon/colour/threshold/period/repeatable/active at **Admin → Badges**.
  - Engine `lib/badges.ts` evaluates on every submission/status/activity change (`evaluateAndAward`) plus a
    nightly `/api/cron/evaluate-badges` for time-based + comparative badges. One-time badges de-dupe; weekly/
    monthly badges repeat per period.
  - Recruiter dashboard **Achievements** panel: earned vs locked with **progress bars**, **Unlocked/Locked**
    tags, hover tooltips, and a **celebration toast** (`seen_at` tracks first view).
- **Manager Team → Recruiter performance** panel: dropdown (Overall / per recruiter), **bar + pie charts**,
  plain-English summary, and an analytics table — **conversion %, momentum ▲▼, goal attainment %, data quality %**.
- **Manager My day → Performance** card with a **Today / Week / Month / Year** dropdown.
- **Richer candidate fields** on submissions (phone, location, experience, company, title, CTC, expected CTC,
  notice, source, skills, resume/LinkedIn URLs) — collapsible "candidate details" in the submit form.
- **Daily self-reported submission counts** (internal & client) on the daily update form + emailed form.
- **Polish**: Sora display font + tabular figures; **colour-coded priority** (High=red / Medium=amber / Low=green)
  and **requirement status** (Open=indigo / On hold=amber / Filled=green / Cancelled=red) badges throughout.

## Everything from the original brief is now built. Remaining is operational, not feature work:
1. **Run it**: `npm install && npm run dev`. Fix the small breaks (most likely: a recharts SSR
   import, or a Supabase nested-select alias). It has never been compiled here.
2. Set env: Supabase keys, NEXT_PUBLIC_APP_URL, CRON_SECRET, GEMINI_API_KEY, and (for email) RESEND.
3. Deploy to Vercel; the three crons in `vercel.json` run on schedule (3 AM IST daily form, etc.).

## Open items by choice / known limitations (all flagged in code)
- Daily-email form's password step bypasses 2FA — recommend switching to token-only (one block in
  `app/daily/[token]/actions.ts`).
- One recruiter = one division (no multi-division manager); manager writes aren't division-scoped.
- No automated tests / CI.

## First run order
1. Create your auth user (Supabase dashboard) → trigger makes a recruiter profile.
2. `update profiles set role='admin' where email='you@...';`
3. Sign in → go to **Admin** → create the rest of the accounts, set divisions/targets,
   add requirements, and allocate them. Now the recruiter + manager views have real data.

## Testing the crons manually
They require the secret. Example:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/snapshot
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/generate-alerts
```
Note: `snapshot` only writes when the IST date is a period boundary (Mon / 1st / Jan 1).
To see leaderboards immediately, add submissions and mark some as a closure status — the
*current* month leaderboard computes live; snapshots are for finalized past periods.

## Setup
1. Create a Supabase project.
2. In the SQL editor run, in order: `supabase/schema.sql` then `supabase/rls.sql`.
3. Copy `.env.example` to `.env.local` and fill values (URL, anon key, service role key,
   APP_URL, CRON_SECRET, optional RESEND_API_KEY + DAILY_FROM_EMAIL).
4. `npm install && npm run dev`.

## Create the first admin
There is no signup screen (admin provisions accounts — Admin module comes later). For now:
1. Create a user in Supabase Auth (Dashboard → Authentication → Add user), or have them
   sign up once if you temporarily enable signups.
2. The `on_auth_user_created` trigger creates a `recruiter` profile automatically.
3. Promote yourself:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
4. For recruiters, set their division (and optional target):
   ```sql
   update profiles
     set division_id = (select id from divisions where code = 'US_IT'),
         monthly_submission_target = 25
   where email = 'recruiter@example.com';
   ```

## 2FA
Login already handles the TOTP challenge if a user has a factor enrolled. The **enrollment
screen** (show QR, verify code) is part of a later slice. Until then, enroll via the
Supabase MFA API or a temporary page.

## Security note on the daily form
The emailed link's token is high-entropy, single-use, and expiring — it already
authenticates the recruiter (a magic link). The form also asks for the account password
as a second check (as requested), but that step **bypasses your 2FA** and trains
password-entry-from-email. To drop it: remove the `signInWithPassword` block in
`app/daily/[token]/actions.ts`. Recommended: token-only, or TOTP as the second factor.

## Cron
`vercel.json` schedules `/api/cron/daily-tokens` at `30 21 * * *` UTC = 03:00 IST.
Vercel sends `Authorization: Bearer $CRON_SECRET`; the route rejects anything else.
