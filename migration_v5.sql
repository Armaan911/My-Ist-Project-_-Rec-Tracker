-- =============================================================
-- MIGRATION v5 — admin-configurable daily metrics
-- Run AFTER migration_v4.sql, top to bottom, in the Supabase SQL editor.
--
-- WHAT THIS DOES
--  1) daily_metrics          — the set of things recruiters log each day.
--                              Admins add / edit / delete / reorder these at runtime.
--  2) daily_activity_values  — one row per (recruiter, requirement, day, metric).
--                              Replaces the fixed columns on daily_activity_items so
--                              the metric list can change without a schema change.
--  3) Seeds a sensible default metric set (incl. internal & client submissions).
--  4) Best-effort copy of any existing daily_activity_items data into the new table.
--
-- The legacy daily_activity summary + daily_activity_items table are KEPT so older
-- code paths (badges, "logged today") keep working; the app now writes the EAV table
-- and rolls a summary back into daily_activity.
-- =============================================================

-- ---------- 0) REMOVE the deprecated reusable portal-link system ----------
-- The dashboard "copy link" now mints single-use daily_form_tokens (the same link the
-- 3 AM cron emails), so portal_links is no longer used by anything. Safe to drop.
drop table if exists portal_links cascade;

-- ---------- 1) METRIC DEFINITIONS ----------
create table if not exists daily_metrics (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,                 -- machine key, e.g. 'internal_submissions'
  label        text not null,                         -- shown to recruiters
  hint         text,                                  -- one-line helper under the control
  color        text not null default '#5B5BD6',       -- hex accent
  icon         text not null default 'activity',      -- icon name (fixed client set)
  input_style  text not null default 'slider',        -- slider | stepper | chips | tally | dial
  soft_max     int  not null default 20,              -- scale hint for slider/dial
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_daily_metrics_active on daily_metrics (is_active, sort_order);

-- ---------- 2) EAV VALUES ----------
create table if not exists daily_activity_values (
  id             uuid primary key default gen_random_uuid(),
  recruiter_id   uuid not null references profiles(id),
  requirement_id uuid not null references requirements(id) on delete cascade,
  division_id    uuid not null references divisions(id),
  activity_date  date not null default current_date,
  metric_id      uuid not null references daily_metrics(id) on delete cascade,
  value          int  not null default 0,
  is_locked      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (recruiter_id, requirement_id, activity_date, metric_id)
);
create index if not exists idx_dav_recruiter_date on daily_activity_values (recruiter_id, activity_date);
create index if not exists idx_dav_division_date  on daily_activity_values (division_id, activity_date);
create index if not exists idx_dav_metric         on daily_activity_values (metric_id);

create or replace function trg_dav_updated() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists dav_updated on daily_activity_values;
create trigger dav_updated before update on daily_activity_values
  for each row execute function trg_dav_updated();

-- ---------- 3) SEED DEFAULT METRICS (only if table is empty) ----------
insert into daily_metrics (key, label, hint, color, icon, input_style, soft_max, sort_order)
select * from (values
  ('profiles_sourced',     'Profiles sourced',    'Candidates you found',        '#5B5BD6', 'search',        'slider',  40, 10),
  ('resumes_parsed',       'Resumes parsed',      'Resumes you screened',        '#0EA5E9', 'file-text',     'stepper', 40, 20),
  ('internal_submissions', 'Internal submissions','Sent to your internal team',  '#6366F1', 'send',          'chips',   20, 30),
  ('client_submissions',   'Client submissions',  'Submitted to the client',     '#EC4899', 'briefcase',     'chips',   20, 40),
  ('rtr_count',            'RTR taken',           'Right-to-Represent',          '#8B5CF6', 'file-signature','tally',   15, 50),
  ('tech_scheduled',       'Tech scheduled',      'Interviews booked',           '#F59E0B', 'calendar-clock','stepper', 15, 60),
  ('tech_conducted',       'Tech conducted',      'Interviews held',             '#0E9F6E', 'user-check',    'slider',  15, 70),
  ('offers',               'Offers',              'Offers extended',             '#14B8A6', 'gift',          'tally',   10, 80)
) as v(key,label,hint,color,icon,input_style,soft_max,sort_order)
where not exists (select 1 from daily_metrics);

-- ---------- 4) MIGRATE existing daily_activity_items -> values (best effort) ----------
-- daily_activity_items is created by migration_v4 (or database.sql), so it exists here.
-- If you somehow run this before v4, you'll get a clear "relation does not exist" — run v4 first.
insert into daily_activity_values (recruiter_id, requirement_id, division_id, activity_date, metric_id, value, is_locked)
select x.recruiter_id, x.requirement_id, x.division_id, x.activity_date, m.id, x.value, x.is_locked
from (
  select recruiter_id, requirement_id, division_id, activity_date, 'profiles_sourced' as key, profiles_sourced as value, is_locked from daily_activity_items where profiles_sourced > 0
  union all
  select recruiter_id, requirement_id, division_id, activity_date, 'resumes_parsed',   resumes_parsed,   is_locked from daily_activity_items where resumes_parsed > 0
  union all
  select recruiter_id, requirement_id, division_id, activity_date, 'rtr_count',        rtr_count,        is_locked from daily_activity_items where rtr_count > 0
  union all
  select recruiter_id, requirement_id, division_id, activity_date, 'tech_scheduled',   tech_scheduled,   is_locked from daily_activity_items where tech_scheduled > 0
  union all
  select recruiter_id, requirement_id, division_id, activity_date, 'tech_conducted',   tech_conducted,   is_locked from daily_activity_items where tech_conducted > 0
) x
join daily_metrics m on m.key = x.key
on conflict (recruiter_id, requirement_id, activity_date, metric_id) do nothing;

-- =============================================================
-- ROW-LEVEL SECURITY
-- =============================================================
alter table daily_metrics         enable row level security;
alter table daily_activity_values enable row level security;

-- daily_metrics: everyone signed in can read (the form needs them); admin writes.
drop policy if exists dm_read  on daily_metrics;
drop policy if exists dm_write on daily_metrics;
create policy dm_read  on daily_metrics for select using (auth.uid() is not null);
create policy dm_write on daily_metrics for all   using (auth_role()='admin') with check (auth_role()='admin');

-- daily_activity_values: recruiter -> own, manager -> own division, admin -> all.
drop policy if exists dav_select    on daily_activity_values;
drop policy if exists dav_insert    on daily_activity_values;
drop policy if exists dav_update_own on daily_activity_values;
drop policy if exists dav_admin_all on daily_activity_values;
create policy dav_select on daily_activity_values for select using (
  auth_role()='admin' or recruiter_id = auth.uid()
  or (auth_role()='manager' and division_id = auth_division())
);
create policy dav_insert on daily_activity_values for insert with check (recruiter_id = auth.uid());
create policy dav_update_own on daily_activity_values for update
  using  (recruiter_id = auth.uid() and is_locked = false)
  with check (recruiter_id = auth.uid() and is_locked = false);
create policy dav_admin_all on daily_activity_values for all using (auth_role()='admin') with check (auth_role()='admin');
