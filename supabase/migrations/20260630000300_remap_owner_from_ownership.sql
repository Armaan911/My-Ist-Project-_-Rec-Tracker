-- Re-map fetched_profiles.owner_id from the ownership column for rows that were imported
-- before per-row owner matching applied (the 20260630000200 backfill set owner_id to the
-- importer for all existing rows, so ownership was never honoured). Idempotent: only touches
-- rows whose owner differs from the ownership-matched AI-team member. Mirrors matchOwner().
update fetched_profiles fp
set owner_id = p.id
from profiles p
where p.role = 'ai_team'
  and fp.ownership is not null and btrim(fp.ownership) <> ''
  and fp.owner_id is distinct from p.id
  and (
    lower(p.full_name) = lower(btrim(fp.ownership))
    or lower(p.email) = lower(btrim(fp.ownership))
    or lower(p.full_name) like lower(btrim(fp.ownership)) || ' %'
    or split_part(lower(p.full_name), ' ', 1) = lower(btrim(fp.ownership))
  );
