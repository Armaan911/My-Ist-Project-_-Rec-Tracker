-- =============================================================
-- MIGRATION v8 — performance indexes + closed-req logging
-- Run AFTER migration_v7.sql. Safe to re-run.
--
-- Adds indexes on the columns the dashboards filter/join on most, to cut the
-- lag on refresh / tab-switch / save / allocate.
-- =============================================================

-- submissions: filtered by recruiter, status, division, dates, requirement
create index if not exists idx_sub_recruiter      on submissions (recruiter_id);
create index if not exists idx_sub_status          on submissions (current_status_id);
create index if not exists idx_sub_division_date   on submissions (division_id, submitted_date);
create index if not exists idx_sub_submitted_date  on submissions (submitted_date);
create index if not exists idx_sub_requirement     on submissions (requirement_id);
create index if not exists idx_sub_last_status_at  on submissions (last_status_at);

-- daily activity values: read by recruiter+date constantly
create index if not exists idx_dav_recruiter_date  on daily_activity_values (recruiter_id, activity_date);
create index if not exists idx_dav_date            on daily_activity_values (activity_date);

-- status history: joined by submission + new status
create index if not exists idx_ssh_submission      on submission_status_history (submission_id);
create index if not exists idx_ssh_new_status      on submission_status_history (new_status_id);

-- allocations: looked up by recruiter and by requirement
create index if not exists idx_alloc_recruiter     on allocations (recruiter_id);
create index if not exists idx_alloc_requirement   on allocations (requirement_id);

-- requirements: filtered by division + status
create index if not exists idx_req_division_status on requirements (division_id, status);
