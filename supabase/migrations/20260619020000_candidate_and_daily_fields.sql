-- =============================================================
-- Richer candidate details on submissions + daily self-reported submission counts
-- Safe to run once.
-- =============================================================

-- ---------- SUBMISSIONS: candidate detail fields (all optional) ----------
alter table submissions
  add column if not exists phone            text,
  add column if not exists current_location text,
  add column if not exists total_experience numeric,        -- years (e.g. 4.5)
  add column if not exists current_company  text,
  add column if not exists current_title    text,
  add column if not exists current_ctc      text,           -- free-form (e.g. "12 LPA", "$90k")
  add column if not exists expected_ctc     text,
  add column if not exists notice_period    text,            -- e.g. "30 days", "Immediate"
  add column if not exists source           text,            -- LinkedIn / Naukri / Referral / Job board
  add column if not exists key_skills       text,
  add column if not exists resume_url        text,
  add column if not exists linkedin_url      text;

-- ---------- DAILY ACTIVITY: self-reported submission counts ----------
alter table daily_activity
  add column if not exists internal_submissions int not null default 0,
  add column if not exists client_submissions   int not null default 0;
