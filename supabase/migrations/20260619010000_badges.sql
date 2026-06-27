-- =============================================================
-- Recruiter Achievement & Badge System
--   badges            -> admin-configurable badge definitions
--   recruiter_badges  -> awards (one row per recruiter/badge/period)
-- Run after the manager-features migration. Safe to run once.
-- =============================================================

-- ---------- BADGE DEFINITIONS (admin-configurable) ----------
create table if not exists badges (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  description   text,
  icon          text,                       -- emoji shown in the UI
  color         text default '#6366f1',
  rule          text not null,              -- evaluator key (see lib/badges.ts)
  threshold     int,                        -- numeric bar for the rule (null for comparative)
  period        text not null default 'once', -- once | weekly | monthly | yearly
  is_repeatable boolean not null default false,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- AWARDS ----------
create table if not exists recruiter_badges (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references profiles(id) on delete cascade,
  badge_id     uuid not null references badges(id) on delete cascade,
  period_key   text not null default 'all', -- 'all' for one-time, else 'YYYY', 'YYYY-MM', 'YYYY-Www'
  count        int not null default 1,
  seen_at      timestamptz,                 -- null => not yet celebrated on the dashboard
  created_at   timestamptz not null default now(),
  unique (recruiter_id, badge_id, period_key)
);
create index if not exists idx_recruiter_badges_recruiter on recruiter_badges (recruiter_id);

alter table badges           enable row level security;
alter table recruiter_badges enable row level security;

-- badges: any authenticated user reads; admins write
drop policy if exists badges_read on badges;
create policy badges_read on badges for select using (auth.uid() is not null);
drop policy if exists badges_write on badges;
create policy badges_write on badges for all using (auth_role()='admin') with check (auth_role()='admin');

-- awards: recruiter reads own; manager/admin read all; recruiter marks own seen; inserts via service role
drop policy if exists rb_select on recruiter_badges;
create policy rb_select on recruiter_badges for select using (
  recruiter_id = auth.uid() or auth_role() in ('admin','manager')
);
drop policy if exists rb_update_own on recruiter_badges;
create policy rb_update_own on recruiter_badges for update
  using (recruiter_id = auth.uid() or auth_role()='admin')
  with check (recruiter_id = auth.uid() or auth_role()='admin');
drop policy if exists rb_admin_all on recruiter_badges;
create policy rb_admin_all on recruiter_badges for all
  using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- SEED: realistic catalog for 15–25 submissions/month ----------
insert into badges (code, name, description, icon, color, rule, threshold, period, is_repeatable, sort_order) values
  ('first_submission',      'First Submission',        'Logged your very first candidate submission.',          '🎯', '#6366f1', 'submissions_total',   1,   'once',    false, 10),
  ('first_submission_week', 'Week Starter',            'First submission of the week — start strong!',           '🌅', '#f59e0b', 'submissions_week',    1,   'weekly',  true,  20),
  ('subs_5',                'High Five',               '5 submissions in a month.',                              '✋', '#0ea5e9', 'submissions_month',   5,   'monthly', true,  30),
  ('subs_10',               'Double Digits',           '10 submissions in a month.',                             '🔟', '#3b82f6', 'submissions_month',   10,  'monthly', true,  40),
  ('top_submitter',         'Top Submitter',           'Most submissions of anyone this month.',                 '🏆', '#eab308', 'top_submitter_month', null,'monthly', true,  50),
  ('first_placement',       'First Placement',         'Landed your first closure.',                             '⭐', '#22c55e', 'closures_total',      1,   'once',    false, 60),
  ('placement_star',        'Placement Star',          '3 all-time closures.',                                   '🌟', '#16a34a', 'closures_total',      3,   'once',    false, 70),
  ('quality_recruiter',     'Quality Recruiter',       '90%+ of this month''s submissions have complete data.',  '💎', '#06b6d4', 'quality_month',       90,  'monthly', true,  80),
  ('consistent_recruiter',  'Consistent Recruiter',    'Logged activity on 4+ days this week.',                  '📅', '#8b5cf6', 'activity_days_week',  4,   'weekly',  true,  90),
  ('status_champion',       'Status Champion',         'Used 5+ pipeline stages — you work the whole funnel.',   '🛤️', '#ec4899', 'distinct_statuses',   5,   'once',    false, 100),
  ('hat_trick',             'Hat Trick',               '3 closures in a single month.',                          '🎩', '#f43f5e', 'closures_month',      3,   'monthly', true,  110),
  ('recruiter_of_month',    'Recruiter of the Month',  'Most closures of anyone this month.',                    '👑', '#d97706', 'recruiter_of_month',  null,'monthly', true,  120)
on conflict (code) do nothing;
