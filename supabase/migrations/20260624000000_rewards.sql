-- ============================================================
--  Closure reward workflow.
--  Recruiter records a closure -> reward_request (pending_manager)
--    -> manager confirms -> email to HR (tokenized approve/reject link)
--    -> HR approves/rejects -> manager/admin marks "initiated".
-- ============================================================

create table if not exists reward_requests (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid references submissions(id) on delete set null,
  recruiter_id         uuid not null references profiles(id) on delete cascade,
  division_id          uuid references divisions(id),
  candidate_name       text,
  requirement_title    text,
  -- pending_manager | manager_confirmed | hr_approved | hr_rejected | initiated | rejected
  status               text not null default 'pending_manager',
  manager_id           uuid references profiles(id),
  manager_confirmed_at timestamptz,
  hr_email             text,
  hr_token_hash        text,                 -- sha256 of the raw token sent in the HR link
  hr_decision          text,                 -- approved | rejected
  hr_decided_at        timestamptz,
  initiated_at         timestamptz,
  initiated_by         uuid references profiles(id),
  note                 text,
  created_at           timestamptz not null default now()
);

create index if not exists idx_reward_requests_status on reward_requests (status, created_at desc);
create index if not exists idx_reward_requests_recruiter on reward_requests (recruiter_id);
-- one reward per closed submission
create unique index if not exists uq_reward_requests_submission on reward_requests (submission_id) where submission_id is not null;

alter table reward_requests enable row level security;

-- Recruiters read their own; admins & managers read all (the manager UI scopes by division in code).
drop policy if exists reward_select on reward_requests;
create policy reward_select on reward_requests for select using (
  recruiter_id = auth.uid() or auth_role() in ('admin','manager')
);
-- No end-user INSERT/UPDATE policy: all writes go through service-role server actions / the HR token route.

-- HR recipient address (admin-editable on the Configuration page).
insert into app_settings (key, value, description)
values ('hr_email', '{"email":""}'::jsonb, 'HR recipient for closure reward emails')
on conflict (key) do nothing;
