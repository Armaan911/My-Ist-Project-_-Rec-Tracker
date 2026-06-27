-- A recruiter can optionally also be a coordinator (flagged at account creation).
alter table profiles add column if not exists is_coordinator boolean not null default false;
