-- Per-closure placement/revenue value (entered by managers) used by the
-- manager-only Revenue tracker. Separate from `amount` (the recruiter incentive).
alter table reward_requests
  add column if not exists revenue_value    numeric(14,2),
  add column if not exists revenue_currency text not null default 'INR';
