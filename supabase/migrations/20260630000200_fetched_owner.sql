-- A parsed profile is OWNED by the AI-team member named in its ownership column (matched at
-- import). It shows on that owner's AI desk. Backfill existing rows to the importer.
alter table fetched_profiles add column if not exists owner_id uuid references profiles(id);
update fetched_profiles set owner_id = ai_team_id where owner_id is null;
create index if not exists idx_fetched_profiles_owner on fetched_profiles (owner_id);
