-- Coordinator verification: a recruiter with coordinator access verifies other
-- recruiters' submissions and daily activity logs. Manager/admin analytics can then
-- be filtered to verified-only.
alter table submissions    add column if not exists verified_by uuid references profiles(id);
alter table submissions    add column if not exists verified_at timestamptz;
alter table daily_activity add column if not exists verified_by uuid references profiles(id);
alter table daily_activity add column if not exists verified_at timestamptz;
create index if not exists idx_submissions_verified on submissions (verified_at);
create index if not exists idx_daily_activity_verified on daily_activity (verified_at);
