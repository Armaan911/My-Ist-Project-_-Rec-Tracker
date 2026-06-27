-- Track when a fetched profile's status last changed, so the daily cron can digest
-- non-milestone status updates to the AI team (milestones notify instantly + email).
alter table fetched_profiles add column if not exists status_changed_at timestamptz;
