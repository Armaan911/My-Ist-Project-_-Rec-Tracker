# Recruit Tracker — Setup

Full-stack recruitment tracking platform. Next.js (App Router) + Supabase + Gemini, deploys on Vercel.

This guide gets it running on a fresh machine.

---

## 1. Prerequisites
- Node.js 18.18+ (or 20+)
- A Supabase project (free tier is fine)
- An email provider for the daily form (Resend **or** Microsoft Outlook/Graph) — optional for local dev

## 2. Install
```bash
npm install
```

## 3. Database
Open the Supabase SQL editor and run **one** of these:

- **Brand-new database (recommended):** paste and run `database.sql`. It creates every table, view, RLS policy, trigger, and seeds default divisions, submission statuses, medal tiers, badges, and **daily metrics**. Done — skip to step 4.

- **Upgrading a database that already has older data:** run the migrations in order:
  1. `migration_v4.sql` — job codes, multi-division (`profile_divisions`), per-requirement daily activity, and the requirement-read fix.
  2. `migration_v5.sql` — admin-configurable **daily metrics** (`daily_metrics` + `daily_activity_values`) and a best-effort copy of any existing daily data into the new model.
  3. `migration_v6.sql` — **profile + candidate photos**: adds `avatar_url` / `candidate_photo_url` columns and two public storage buckets (`avatars`, `candidates`). If the storage-policy statements error in your project, create the two buckets by hand in Supabase → Storage (mark them **public**) and the rest still works.
  4. `migration_v7.sql` — **performance tracking**: adds `recruiter_goals` (per-month targets set by managers/admins) and the configurable leaderboard score weights.
  5. `migration_v8.sql` — **performance indexes**: adds indexes on the columns the dashboards filter on, to cut lag on refresh/save/allocate. Also enables logging against closed requirements (code change, no schema).

  Run them in order (v4 → v5 → v6 → v7 → v8). All are safe to re-run.

> Create the demo accounts in **Supabase → Authentication → Users** (or your own). Then in SQL set roles, e.g.
> `update profiles set role='admin' where email='admin@demo.com';`

## 4. Environment
Copy `.env.example` to `.env.local` and fill it in:
```bash
cp .env.example .env.local
```
Minimum to boot locally:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000` for dev)
- `CRON_SECRET` (any long random string)

Optional: `RESEND_API_KEY` + `DAILY_FROM_EMAIL` (daily emails — without these, emails are logged, not sent), `GEMINI_API_KEY` (AI manager summaries), and the `MS_*` / `OUTLOOK_*` block (send daily mail via Outlook and parse email replies).

## 5. Run
```bash
npm run dev        # http://localhost:3000
```
Build check:
```bash
npm run build
```

## 6. Deploy (Vercel)
1. Push to a Git repo and import it in Vercel.
2. Add the same env vars in the Vercel project settings (set `NEXT_PUBLIC_APP_URL` to your real domain).
3. `vercel.json` already declares the cron jobs. The daily-update email fires at **3:00 AM IST** (`30 21 * * *` UTC).

---

## What recruiters / managers / admins get

- **Recruiters** — a daily form (drag sliders, steppers, quick chips, tally counters) to log activity per requirement, their pipeline, medals, and badges.
- **Managers** — a team dashboard with clickable stat cards, detailed analytics, a recruiters directory with one-tap daily-form links, and requirement allocation.
- **Admins** — people management (multi-division), requirements + clients, a recruiters directory, **Daily metrics** (add / edit / delete / reorder the things recruiters log), approvals for past-day edits, badges, configuration, and an audit log.

## Daily-update links
- A single-use link is emailed to each active recruiter at 3 AM IST (20-hour expiry, works once).
- Managers and admins can also copy a fresh single-use link for any recruiter from **Recruiters** — it changes every click.

## Customising what recruiters log
**Admin → Daily metrics.** Add a metric (name, helper text, colour, icon, and input style: slider / stepper / quick-chips / tally), reorder with the arrows, hide it with the active toggle, or delete it. Changes apply to everyone's form immediately. The defaults include profiles sourced, resumes parsed, internal submissions, client submissions, RTR, tech scheduled, tech conducted, and offers.

## Known limitations (honest notes)
- The codebase builds clean (`tsc` + `next build`) and the SQL is validated, but it has **not** been runtime-tested end-to-end against live data. Click through each flow after deploying.
- If you use the Outlook **email-reply** path, freeform replies are logged as a flat daily total in the legacy summary — they can't capture the per-requirement / per-metric breakdown. The web form (dashboard or the daily link) is the way to get full per-metric data.
- Deleting a daily metric also deletes the values recruiters logged for it (foreign-key cascade). Use the **hide** toggle instead if you want to keep history.

---

## Install as a phone app (PWA)

Recruit Tracker is a Progressive Web App — it installs to the home screen on Android and iOS, runs full-screen with its own icon, and keeps working (read-only) when the connection drops. No app store needed.

**Requirements:** must be served over **HTTPS** (Vercel gives you this automatically; `localhost` also works for testing). Service workers don't run over plain `http://` on a LAN IP.

**Android (Chrome):** open the site → an "Install Recruit Tracker" prompt appears at the bottom, or use the ⋮ menu → *Install app / Add to Home screen*.

**iPhone/iPad (Safari):** open the site → tap the **Share** button → **Add to Home Screen**. (iOS doesn't support the automatic prompt, so the app shows a hint instead.)

Once installed it launches like a native app. Auth, data, and the daily form all work the same; only fresh data needs a connection (you'll see an offline screen if you open it with no network).

**What's included:** `app/manifest.ts` (web manifest), `public/sw.js` (service worker — offline shell + smart caching, never caches auth/data), `app/offline/page.tsx` (offline fallback), generated icons in `public/icons/`, and an install prompt. To force all installed clients onto a new version after a deploy, bump `CACHE_VERSION` in `public/sw.js`.

---

## Install as a phone app (PWA)

Recruit Tracker is a Progressive Web App — it installs to the home screen on Android and iOS with its own icon, full-screen (no browser chrome), and an offline screen. No app stores, no separate build.

**Requirement:** it must be served over **HTTPS**. Vercel gives you that automatically. (On `localhost` it also works for testing, since localhost counts as a secure context.)

**Android (Chrome):** open the site → an "Install Recruit Tracker" banner appears, or use ⋮ menu → *Add to Home screen / Install app*.

**iPhone/iPad (Safari):** open the site → tap the **Share** button → **Add to Home Screen**. (iOS doesn't support an automatic install button — the app shows the Share-sheet hint instead.)

Once installed it launches full-screen from the home icon. Long-pressing the icon on Android exposes shortcuts to **Log today** and **Team**.

**What works offline:** screens you've already opened still render, and you get a branded offline page if you navigate somewhere new with no connection. Logging activity and loading live data still need a connection (the app never caches another user's data).

**What's included:** `public/manifest.webmanifest`, app icons (`public/icons/`), the service worker (`public/sw.js`), the offline route (`/offline`), and the install prompt — all already wired into the app. Nothing extra to configure; just deploy over HTTPS.

> Note on push notifications: the daily reminder is delivered by **email** (the 3 AM cron), which works everywhere. True home-screen push notifications are reliable on Android PWAs but limited on iOS; if you need solid native push later, the next step up is wrapping this same app with Capacitor.
