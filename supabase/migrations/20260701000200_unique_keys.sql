-- Business keys / de-duplication:
--  • job_code uniquely identifies a job requirement (case-insensitive).
--  • a candidate's LinkedIn URL uniquely identifies them within a requirement, for both
--    AI-parsed candidates (fetched_profiles) and recruiter submissions. (Per-requirement,
--    because the same person can legitimately be put forward for different requirements.)
-- Stored lower-cased so "…/in/John" and "…/in/john" collide. Blank/null values are exempt.

create unique index if not exists requirements_job_code_uq
  on requirements (lower(job_code)) where job_code is not null and job_code <> '';

create unique index if not exists fetched_profiles_req_linkedin_uq
  on fetched_profiles (requirement_id, lower(linkedin_url)) where linkedin_url is not null and linkedin_url <> '';

create unique index if not exists submissions_req_linkedin_uq
  on submissions (requirement_id, lower(linkedin_url)) where linkedin_url is not null and linkedin_url <> '';
