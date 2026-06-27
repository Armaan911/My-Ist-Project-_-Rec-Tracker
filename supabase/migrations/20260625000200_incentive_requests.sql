-- ============================================================
--  Recruiter-initiated incentive requests + one-click manager/admin approval.
--  A recruiter requests an incentive -> reward_request (source='recruiter_request',
--  pending_manager) -> each manager/admin gets a unique no-login approve/reject link
--  -> on approve it goes to HR (manager_confirmed); on reject it's rejected.
-- ============================================================

-- Distinguish recruiter-requested incentives from closure-derived ones.
alter table reward_requests add column if not exists source text not null default 'closure';

-- Per-recipient approve/reject tokens for the manager/admin step (one row per reviewer
-- so we can attribute who approved). Hash only — the raw token lives only in the email link.
create table if not exists reward_approval_tokens (
  id          uuid primary key default gen_random_uuid(),
  reward_id   uuid not null references reward_requests(id) on delete cascade,
  approver_id uuid references profiles(id) on delete set null,
  token_hash  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_reward_approval_tokens_hash on reward_approval_tokens (token_hash);
create index if not exists idx_reward_approval_tokens_reward on reward_approval_tokens (reward_id);

alter table reward_approval_tokens enable row level security;
-- No end-user policies: all access is via service-role server actions and the public token route.
