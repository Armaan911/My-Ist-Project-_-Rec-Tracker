-- =============================================================
-- Recruit Tracker — MIGRATION v4 (feature update batch)
-- Safe to run ONCE on an existing v3 database. Idempotent where possible.
-- Adds:
--   1) requirements.job_code
--   6) daily_activity_items  (per-requirement daily effort)
--   4) portal_links          (reusable no-login daily-update form link)
--   9) profile_divisions     (a recruiter can belong to MANY divisions)
--  11) requirement read fix  (recruiter can read reqs allocated to them)
-- Run top to bottom in the Supabase SQL editor.
-- =============================================================

-- ---------- 1) JOB CODE on requirements ----------
alter table requirements add column if not exists job_code text;

-- ---------- 9) MULTI-DIVISION per profile ----------
create table if not exists profile_divisions (
  profile_id  uuid not null references profiles(id) on delete cascade,
  division_id uuid not null references divisions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, division_id)
);
-- Backfill from the existing single division so nobody loses access.
insert into profile_divisions (profile_id, division_id)
  select id, division_id from profiles where division_id is not null
  on conflict do nothing;

-- ---------- 6/7/8) PER-REQUIREMENT DAILY ACTIVITY ----------
-- One row per recruiter / requirement / day. The old daily_activity table is
-- kept as a rolled-up summary (sum across items) so badges + manager cards keep working.
create table if not exists daily_activity_items (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references profiles(id),
  requirement_id    uuid not null references requirements(id) on delete cascade,
  division_id       uuid not null references divisions(id),
  activity_date     date not null default current_date,
  profiles_sourced  int  not null default 0,   -- No. of profiles sourced
  resumes_parsed    int  not null default 0,   -- No. of resumes parsed
  rtr_count         int  not null default 0,   -- No. of RTR (Right to Represent)
  tech_scheduled    int  not null default 0,   -- No. of technicals scheduled
  tech_conducted    int  not null default 0,   -- No. of technicals conducted
  notes             text,
  is_locked         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recruiter_id, requirement_id, activity_date)
);
create index if not exists idx_dai_recruiter_date on daily_activity_items (recruiter_id, activity_date);
create index if not exists idx_dai_division_date  on daily_activity_items (division_id, activity_date);

drop trigger if exists trg_dai_updated on daily_activity_items;
create trigger trg_dai_updated
  before update on daily_activity_items
  for each row execute function set_updated_at();

-- ---------- 4) PORTAL LINKS (reusable, no-login daily form) ----------
-- We store only a HASH of the token. The raw token lives only in the copied URL.
-- Unlike daily_form_tokens these are reusable (the recruiter fills today's update
-- whenever they open the link) and not pinned to a single date.
create table if not exists portal_links (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references profiles(id) on delete cascade,
  token_hash   text unique not null,
  is_active    boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_portal_links_recruiter on portal_links (recruiter_id);

-- =============================================================
-- ROW-LEVEL SECURITY for the new tables
-- =============================================================
alter table profile_divisions    enable row level security;
alter table daily_activity_items enable row level security;
alter table portal_links         enable row level security;

-- profile_divisions: authenticated read (allocation UI needs it), admin writes.
drop policy if exists pd_read  on profile_divisions;
drop policy if exists pd_write on profile_divisions;
create policy pd_read  on profile_divisions for select using (auth.uid() is not null);
create policy pd_write on profile_divisions for all   using (auth_role()='admin') with check (auth_role()='admin');

-- daily_activity_items: recruiter -> own, manager -> own division, admin -> all.
drop policy if exists dai_select     on daily_activity_items;
drop policy if exists dai_insert      on daily_activity_items;
drop policy if exists dai_update_own  on daily_activity_items;
drop policy if exists dai_admin_all   on daily_activity_items;
create policy dai_select on daily_activity_items for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and division_id = auth_division())
);
create policy dai_insert on daily_activity_items for insert with check (recruiter_id = auth.uid());
create policy dai_update_own on daily_activity_items for update
  using  (recruiter_id = auth.uid() and is_locked = false)
  with check (recruiter_id = auth.uid() and is_locked = false);
create policy dai_admin_all on daily_activity_items for all using (auth_role()='admin') with check (auth_role()='admin');

-- portal_links: no end-user policies => default deny. Minted/validated by the service role only.

-- =============================================================
-- 11) REQUIREMENT READ FIX
-- A recruiter must be able to READ a requirement that is allocated to them,
-- even if it belongs to a division other than their primary one, AND any
-- requirement in a division they belong to (profile_divisions).
-- =============================================================
drop policy if exists req_read on requirements;
create policy req_read on requirements for select using (
  auth_role() = 'admin'
  or division_id = auth_division()
  or exists (select 1 from profile_divisions pd
               where pd.profile_id = auth.uid() and pd.division_id = requirements.division_id)
  or exists (select 1 from allocations a
               where a.requirement_id = requirements.id and a.recruiter_id = auth.uid())
);

-- Allocations: allow recruiters to also read by division membership (kept permissive).
drop policy if exists alloc_read on allocations;
create policy alloc_read on allocations for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and exists (
        select 1 from profiles p where p.id = allocations.recruiter_id and p.division_id = auth_division()))
);

-- =============================================================
-- Done. (database.sql carries the same definitions for fresh installs.)
-- =============================================================
