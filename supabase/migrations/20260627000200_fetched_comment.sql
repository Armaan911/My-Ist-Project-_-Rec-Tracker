-- Recruiters can leave a comment on each AI-team-sourced candidate (separate from status).
alter table fetched_profiles add column if not exists recruiter_comment text;
