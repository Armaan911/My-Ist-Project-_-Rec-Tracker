-- ============================================================
--  AI team role + fetched-profile pipeline.
--  AI team imports candidate rows (from a sheet/CSV) against a requirement and
--  assigns POC recruiter(s). Each row shows on the assigned recruiters' dashboards,
--  who upload a resume and move it through the status workflow.
-- ============================================================

alter type user_role add value if not exists 'ai_team';

create table if not exists fetched_profiles (
  id             uuid primary key default gen_random_uuid(),
  requirement_id uuid references requirements(id) on delete set null,
  ai_team_id     uuid references profiles(id) on delete set null,   -- who imported
  candidate_name text,
  linkedin_url   text,
  location       text,
  email          text,
  phone          text,
  open_to_work   boolean,
  ownership      text,
  -- not_a_fit | junior | strong | connected | in_conversation | tech_scheduled |
  -- tech_conducted | rejected_tech | internal_submission | client_submission | closure
  status         text not null default 'connected',
  resume_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_fetched_profiles_req on fetched_profiles (requirement_id);
create index if not exists idx_fetched_profiles_status on fetched_profiles (status);

-- Assigned POC recruiter(s) for each fetched profile (single or multiple).
create table if not exists fetched_profile_pocs (
  fetched_profile_id uuid not null references fetched_profiles(id) on delete cascade,
  recruiter_id       uuid not null references profiles(id) on delete cascade,
  primary key (fetched_profile_id, recruiter_id)
);
create index if not exists idx_fetched_pocs_recruiter on fetched_profile_pocs (recruiter_id);

alter table fetched_profiles enable row level security;
alter table fetched_profile_pocs enable row level security;
-- No end-user policies: all access via service-role server actions / role-gated pages.
