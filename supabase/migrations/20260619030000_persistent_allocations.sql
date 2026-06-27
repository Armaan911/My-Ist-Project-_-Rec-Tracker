-- =============================================================
-- Persistent allocations: an allocation is an ongoing assignment of a
-- requirement to a recruiter (no longer per-day). It stays until removed.
-- Safe to run once.
-- =============================================================

-- 1) De-duplicate so each (requirement, recruiter) pair has a single row (keep one).
delete from allocations a using allocations b
 where a.requirement_id = b.requirement_id
   and a.recruiter_id   = b.recruiter_id
   and a.ctid > b.ctid;

-- 2) Swap per-day uniqueness for persistent (requirement, recruiter) uniqueness.
alter table allocations drop constraint if exists allocations_requirement_id_recruiter_id_allocation_date_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'allocations_req_recruiter_key') then
    alter table allocations add constraint allocations_req_recruiter_key unique (requirement_id, recruiter_id);
  end if;
end $$;

-- allocation_date now records WHEN the assignment was made (informational).
