-- =============================================================
-- MIGRATION v7 — performance tracking
-- Run AFTER migration_v6.sql in the Supabase SQL editor.
--
--  1) recruiter_goals      — per-month submission/closure targets a manager or admin
--                            sets for a recruiter. Gives goal history for the scorecard.
--  2) leaderboard_weights  — admin-tunable weights for the configurable leaderboard score.
-- =============================================================

create table if not exists recruiter_goals (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references profiles(id) on delete cascade,
  period_month      text not null,                 -- 'YYYY-MM'
  submission_target int,
  closure_target    int,
  set_by            uuid references profiles(id),
  updated_at        timestamptz not null default now(),
  unique (recruiter_id, period_month)
);
create index if not exists idx_recruiter_goals_recruiter on recruiter_goals (recruiter_id);

alter table recruiter_goals enable row level security;

drop policy if exists rg_select     on recruiter_goals;
drop policy if exists rg_admin_all   on recruiter_goals;
drop policy if exists rg_mgr_write    on recruiter_goals;
-- read: own, admin, or a manager of the recruiter's division
create policy rg_select on recruiter_goals for select using (
  auth_role() = 'admin'
  or recruiter_id = auth.uid()
  or (auth_role() = 'manager' and recruiter_id in (select id from profiles where division_id = auth_division()))
);
-- write: admins via RLS; managers write through the service-role action (role+division checked in code)
create policy rg_admin_all on recruiter_goals for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- Configurable leaderboard score weights
insert into app_settings (key, value, description) values
  ('leaderboard_weights', '{"submissions":1,"closures":5,"active_days":2}', 'Weights for the configurable leaderboard score')
  on conflict (key) do nothing;
