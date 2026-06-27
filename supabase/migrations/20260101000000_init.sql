-- =============================================================
-- Recruit Tracker — COMPLETE DATABASE (single file)
-- Run this once in any Postgres/Supabase SQL editor (local Studio
-- at :54323, or your cloud project's SQL editor). Top to bottom.
--
-- Sections:
--   1) Tables, enums, triggers, views, reference data
--   2) Row-Level Security (roles & access rules)
--   3) Demo accounts  <-- delete section 3 for production
-- =============================================================

-- =============================================================
-- SECTION 1 — SCHEMA (all tables + reference data)
-- =============================================================
-- =============================================================
-- Recruitment Tracking Platform — Database Schema (PostgreSQL / Supabase)
-- v3: + alerts, + performance_snapshots, + per-recruiter submission target,
--     + daily_form_tokens (no-login daily email form), + new-user trigger.
-- Run this first, then rls.sql.
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role          as enum ('admin', 'manager', 'recruiter');
create type requirement_status as enum ('open', 'on_hold', 'closed', 'filled', 'cancelled');
create type change_status      as enum ('pending', 'approved', 'rejected');
create type medal_period       as enum ('all_time', 'yearly', 'monthly', 'weekly');
create type snapshot_period    as enum ('weekly', 'monthly', 'yearly');

-- ---------- DIVISIONS ----------
create table divisions (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------- PROFILES (links to Supabase auth.users; 2FA/TOTP lives in Supabase Auth) ----------
create table profiles (
  id                     uuid primary key,             -- = auth.users.id
  full_name              text not null,
  email                  text unique not null,
  role                   user_role not null default 'recruiter',
  division_id            uuid references divisions(id),
  monthly_closure_target int,                          -- admin-set; medals derive from ACTUAL closures, not this
  monthly_submission_target int,                       -- admin-set; null => fall back to app_settings global rule
  is_active              boolean not null default true,
  created_at             timestamptz not null default now()
);

-- ---------- CLIENTS ----------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  division_id uuid references divisions(id),
  created_at  timestamptz not null default now()
);

-- ---------- REQUIREMENTS ----------
create table requirements (
  id            uuid primary key default gen_random_uuid(),
  division_id   uuid not null references divisions(id),
  client_id     uuid references clients(id),
  title         text not null,
  positions     int  not null default 1,
  priority      text,
  status        requirement_status not null default 'open',
  date_received date not null default current_date,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- ---------- ALLOCATIONS (daily allocation of reqs to recruiters) ----------
create table allocations (
  id              uuid primary key default gen_random_uuid(),
  requirement_id  uuid not null references requirements(id) on delete cascade,
  recruiter_id    uuid not null references profiles(id),
  allocation_date date not null default current_date,
  allocated_by    uuid references profiles(id),
  created_at      timestamptz not null default now(),
  unique (requirement_id, recruiter_id, allocation_date)
);

-- ---------- DAILY ACTIVITY (top-of-funnel effort per recruiter per day) ----------
create table daily_activity (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references profiles(id),
  division_id       uuid not null references divisions(id),
  activity_date     date not null default current_date,
  resumes_sourced   int  not null default 0,
  applicants_parsed int  not null default 0,
  notes             text,
  is_locked         boolean not null default false,  -- locked after day ends; edits route to change_requests
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recruiter_id, activity_date)
);

-- ---------- SUBMISSION STATUSES (admin-extensible pipeline stages) ----------
create table submission_statuses (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,
  label             text not null,
  sort_order        int  not null default 0,
  counts_as_closure boolean not null default false,  -- drives medals + closure metrics
  is_rejection      boolean not null default false,
  is_terminal       boolean not null default false,
  is_active         boolean not null default true
);

-- ---------- SUBMISSIONS (tracked entries with a lifecycle) ----------
create table submissions (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references profiles(id),
  requirement_id    uuid not null references requirements(id),
  division_id       uuid not null references divisions(id),
  candidate_name    text not null,
  candidate_email   text,
  current_status_id uuid not null references submission_statuses(id),
  submitted_date    date not null default current_date,
  last_status_at    timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- ---------- SUBMISSION STATUS HISTORY ----------
create table submission_status_history (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  old_status_id uuid references submission_statuses(id),
  new_status_id uuid not null references submission_statuses(id),
  changed_by    uuid references profiles(id),
  changed_at    timestamptz not null default now(),
  note          text
);

-- ---------- CHANGE REQUESTS (past-day edit approval queue; admin approves) ----------
create table change_requests (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,        -- 'daily_activity' | 'submission'
  entity_id    uuid not null,
  recruiter_id uuid not null references profiles(id),
  payload      jsonb not null,
  reason       text,
  status       change_status not null default 'pending',
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- MEDAL TIERS (admin-configurable) ----------
create table medal_tiers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  min_closures int  not null,
  period       medal_period not null default 'all_time',
  color        text,
  rank         int  not null
);

-- ---------- ALERTS (admin alarm feed; read/unread) ----------
create table alerts (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null,          -- 'falling_behind' | 'target_missed' | ...
  severity            text not null default 'warning',
  title               text not null,
  body                text,
  about_recruiter_id  uuid references profiles(id),
  division_id         uuid references divisions(id),
  is_read             boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------- PERFORMANCE SNAPSHOTS (performer of week/month/year — stored, won't drift) ----------
create table performance_snapshots (
  id           uuid primary key default gen_random_uuid(),
  period_type  snapshot_period not null,
  period_start date not null,
  period_end   date not null,
  recruiter_id uuid not null references profiles(id),
  division_id  uuid references divisions(id),
  closures     int not null default 0,
  submissions  int not null default 0,
  rank         int,
  is_winner    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (period_type, period_start, recruiter_id)
);

-- ---------- DAILY FORM TOKENS (no-login daily email form) ----------
-- We store a HASH of the token, never the raw token. Raw token goes only in the email link.
create table daily_form_tokens (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references profiles(id),
  token_hash   text unique not null,
  for_date     date not null,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- APP SETTINGS (tunable variables, no code change) ----------
create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- ---------- AUDIT LOG ----------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_daily_activity_updated
  before update on daily_activity
  for each row execute function set_updated_at();

-- ---------- new auth user -> profile row (Supabase pattern) ----------
-- Creates a recruiter profile on signup. Promote to admin/manager via UPDATE.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- VIEW: closures per recruiter (feeds medals + leaderboard) ----------
create view v_recruiter_closures as
select
  p.id as recruiter_id, p.full_name, p.division_id,
  count(s.id) filter (where st.counts_as_closure) as closures_all_time,
  count(s.id) filter (where st.counts_as_closure
    and date_trunc('month', s.last_status_at) = date_trunc('month', now())) as closures_this_month
from profiles p
left join submissions s          on s.recruiter_id = p.id
left join submission_statuses st on st.id = s.current_status_id
where p.role = 'recruiter'
group by p.id, p.full_name, p.division_id;
alter view v_recruiter_closures set (security_invoker = true);

-- =============================================================
-- SEED
-- =============================================================
insert into divisions (code, name) values
  ('DOM','Domestic'), ('IND_IT','India IT'), ('US_IT','US IT');

-- 'Onboarded' added after Closure (you mentioned onboarding earlier); both count toward medals.
insert into submission_statuses (code, label, sort_order, counts_as_closure, is_rejection, is_terminal) values
  ('internal_submitted','Internally Submitted',          10, false, false, false),
  ('client_submitted',  'Submitted to Client',           20, false, false, false),
  ('tech_interview',    'Technical Interview Conducted',  30, false, false, false),
  ('closure',           'Closure (Selected by Client)',   40, true,  false, true ),
  ('onboarded',         'Onboarded',                      50, true,  false, true ),
  ('rejected_internal', 'Rejected Internally',           100, false, true,  true ),
  ('rejected_tech',     'Rejected in Tech',              110, false, true,  true ),
  ('rejected_client',   'Rejected by Client',            120, false, true,  true );

insert into medal_tiers (name, min_closures, period, color, rank) values
  ('Silver',   1,  'all_time', '#C0C0C0', 1),
  ('Gold',     3,  'all_time', '#FFD700', 2),
  ('Platinum', 6,  'all_time', '#E5E4E2', 3),
  ('Diamond',  10, 'all_time', '#B9F2FF', 4);

insert into app_settings (key, value, description) values
  ('falling_behind', '{"min_activity_days_per_week": 4, "min_submissions_per_week": 5}',
   'Global fallback rule the AI/manager view uses to flag recruiters. Per-recruiter monthly_submission_target overrides where set.');


-- =============================================================
-- SECTION 2 — ROW-LEVEL SECURITY
-- =============================================================
-- =============================================================
-- Row-Level Security — run AFTER schema.sql
-- recruiter -> own rows, manager -> own division, admin -> everything.
-- v1 policies. Test each role in Supabase before trusting it.
-- =============================================================

create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_division() returns uuid
  language sql stable security definer set search_path = public as $$
  select division_id from profiles where id = auth.uid()
$$;

alter table profiles                  enable row level security;
alter table divisions                 enable row level security;
alter table clients                   enable row level security;
alter table requirements              enable row level security;
alter table allocations               enable row level security;
alter table daily_activity            enable row level security;
alter table submissions               enable row level security;
alter table submission_status_history enable row level security;
alter table submission_statuses       enable row level security;
alter table change_requests           enable row level security;
alter table medal_tiers               enable row level security;
alter table alerts                    enable row level security;
alter table performance_snapshots     enable row level security;
alter table daily_form_tokens         enable row level security;
alter table app_settings              enable row level security;
alter table audit_log                 enable row level security;

-- ---------- PROFILES ----------
create policy profiles_select on profiles for select using (
  auth_role() = 'admin' or id = auth.uid()
  or (auth_role() = 'manager' and division_id = auth_division())
);
create policy profiles_admin_write on profiles for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ---------- REFERENCE TABLES (authenticated read; admin write) ----------
create policy divisions_read  on divisions          for select using (auth.uid() is not null);
create policy divisions_write on divisions          for all using (auth_role()='admin') with check (auth_role()='admin');
create policy statuses_read   on submission_statuses for select using (auth.uid() is not null);
create policy statuses_write  on submission_statuses for all using (auth_role()='admin') with check (auth_role()='admin');
create policy medals_read     on medal_tiers        for select using (auth.uid() is not null);
create policy medals_write    on medal_tiers        for all using (auth_role()='admin') with check (auth_role()='admin');
create policy settings_read   on app_settings       for select using (auth.uid() is not null);
create policy settings_write  on app_settings       for all using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- CLIENTS / REQUIREMENTS / ALLOCATIONS (admin+manager manage) ----------
create policy clients_read  on clients for select using (auth_role() in ('admin','manager') or division_id = auth_division());
create policy clients_write on clients for all     using (auth_role() in ('admin','manager')) with check (auth_role() in ('admin','manager'));

create policy req_read  on requirements for select using (auth_role()='admin' or division_id = auth_division());
create policy req_write on requirements for all     using (auth_role() in ('admin','manager')) with check (auth_role() in ('admin','manager'));

create policy alloc_read on allocations for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and exists (
        select 1 from profiles p where p.id = allocations.recruiter_id and p.division_id = auth_division()))
);
create policy alloc_write on allocations for all using (auth_role() in ('admin','manager')) with check (auth_role() in ('admin','manager'));

-- ---------- DAILY ACTIVITY ----------
create policy da_select on daily_activity for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and division_id = auth_division())
);
create policy da_insert on daily_activity for insert with check (
  recruiter_id = auth.uid() and division_id = auth_division()
);
create policy da_update_own on daily_activity for update
  using  (recruiter_id = auth.uid() and is_locked = false)
  with check (recruiter_id = auth.uid() and is_locked = false);
create policy da_admin_all on daily_activity for all using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- SUBMISSIONS ----------
create policy sub_select on submissions for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and division_id = auth_division())
);
create policy sub_insert on submissions for insert with check (
  recruiter_id = auth.uid() and division_id = auth_division()
);
create policy sub_update_own on submissions for update
  using (recruiter_id = auth.uid()) with check (recruiter_id = auth.uid());
create policy sub_admin_all on submissions for all using (auth_role()='admin') with check (auth_role()='admin');
create policy sub_delete_own on submissions for delete using (recruiter_id = auth.uid());

-- ---------- STATUS HISTORY ----------
create policy hist_select on submission_status_history for select using (
  auth_role()='admin'
  or exists (select 1 from submissions s where s.id = submission_status_history.submission_id
               and (s.recruiter_id = auth.uid()
                    or (auth_role()='manager' and s.division_id = auth_division())))
);
create policy hist_insert on submission_status_history for insert with check (
  auth_role()='admin'
  or exists (select 1 from submissions s where s.id = submission_status_history.submission_id and s.recruiter_id = auth.uid())
);

-- ---------- CHANGE REQUESTS (recruiter raises; admin approves) ----------
create policy cr_select       on change_requests for select using (auth_role()='admin' or recruiter_id = auth.uid());
create policy cr_insert       on change_requests for insert with check (recruiter_id = auth.uid());
create policy cr_admin_update on change_requests for update using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- ALERTS (admin reads/marks read; manager sees own-division alerts) ----------
create policy alerts_select on alerts for select using (
  auth_role()='admin' or (auth_role()='manager' and division_id = auth_division())
);
create policy alerts_update on alerts for update using (auth_role()='admin' or (auth_role()='manager' and division_id = auth_division())) with check (auth_role()='admin' or (auth_role()='manager' and division_id = auth_division()));
-- inserts happen via service role (cron/AI job), which bypasses RLS.

-- ---------- PERFORMANCE SNAPSHOTS ----------
create policy snap_select on performance_snapshots for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and division_id = auth_division())
);
-- inserts via service role.

-- ---------- DAILY FORM TOKENS ----------
-- No end-user policies => default deny. Generated/validated only by the service role.

-- ---------- AUDIT LOG (admin reads; writes via service role) ----------
create policy audit_admin_read on audit_log for select using (auth_role()='admin');

-- KNOWN v1 GAP: manager writes to clients/requirements/allocations are not yet
-- restricted to the manager's own division (role is checked, target division is not).
-- Fine for a trusted 7–10 person team; tighten later if needed.


-- =============================================================
-- SECTION 3 — DEMO ACCOUNTS  (DELETE EVERYTHING BELOW FOR PRODUCTION)
-- admin@demo.com/Admin@12345 · manager@demo.com/Manager@12345 · recruiter@demo.com/Recruiter@12345
-- =============================================================
-- =============================================================
-- Seed 3 demo accounts. RUN AFTER schema.sql AND rls.sql.
-- Creates working email/password logins + profiles with roles & divisions.
-- Manager and Recruiter share the US IT division so the manager can
-- actually allocate work to that recruiter.
--
-- Logins created:
--   admin@demo.com     / Admin@12345       (admin, all divisions)
--   manager@demo.com   / Manager@12345     (manager, US IT)
--   recruiter@demo.com / Recruiter@12345   (recruiter, US IT)
--
-- One-time script. To re-run, delete these users in
-- Supabase → Authentication → Users first.
-- If your Supabase version rejects an auth.users column, use the
-- dashboard method noted at the bottom instead.
-- =============================================================

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_mgr   uuid := gen_random_uuid();
  v_rec   uuid := gen_random_uuid();
  v_div   uuid;
begin
  select id into v_div from public.divisions where code = 'US_IT' limit 1;

  -- ---- auth users (passwords hashed with bcrypt) ----
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'admin@demo.com', crypt('Admin@12345', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_mgr, 'authenticated', 'authenticated',
     'manager@demo.com', crypt('Manager@12345', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Manager"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_rec, 'authenticated', 'authenticated',
     'recruiter@demo.com', crypt('Recruiter@12345', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Recruiter"}', '', '', '', '');

  -- ---- identities (required for email/password sign-in) ----
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_admin, json_build_object('sub', v_admin::text, 'email', 'admin@demo.com'),     'email', v_admin::text, now(), now(), now()),
    (gen_random_uuid(), v_mgr,   json_build_object('sub', v_mgr::text,   'email', 'manager@demo.com'),   'email', v_mgr::text,   now(), now(), now()),
    (gen_random_uuid(), v_rec,   json_build_object('sub', v_rec::text,   'email', 'recruiter@demo.com'), 'email', v_rec::text,   now(), now(), now());

  -- ---- profiles (the trigger creates rows; we set role + division here) ----
  insert into public.profiles (id, full_name, email, role, division_id, monthly_submission_target)
  values
    (v_admin, 'Demo Admin',     'admin@demo.com',     'admin',     null,  null),
    (v_mgr,   'Demo Manager',   'manager@demo.com',   'manager',   v_div, null),
    (v_rec,   'Demo Recruiter', 'recruiter@demo.com', 'recruiter', v_div, 25)
  on conflict (id) do update
    set role = excluded.role, division_id = excluded.division_id,
        full_name = excluded.full_name, monthly_submission_target = excluded.monthly_submission_target;
end $$;

-- =============================================================
-- DASHBOARD FALLBACK (if the script errors on your Supabase version):
-- 1. Authentication → Users → Add user (Auto Confirm) for each of the 3 emails above.
-- 2. Then run just this to set roles & divisions:
--
-- update public.profiles set role='admin'   where email='admin@demo.com';
-- update public.profiles set role='manager',
--   division_id=(select id from divisions where code='US_IT') where email='manager@demo.com';
-- update public.profiles set role='recruiter',
--   division_id=(select id from divisions where code='US_IT'),
--   monthly_submission_target=25 where email='recruiter@demo.com';
-- =============================================================
