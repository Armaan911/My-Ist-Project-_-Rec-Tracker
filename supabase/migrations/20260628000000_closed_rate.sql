-- Recruiter-entered "closed rate" (the placement / bill value agreed at closure).
-- This is informational context for managers and is NOT what revenue is based on.
--
-- Revenue is driven by PROFIT, which managers record in the existing
-- reward_requests.revenue_value / revenue_currency columns (relabeled "Profit"
-- in the UI). Profit stays visible to managers/admins only; recruiters only ever
-- enter and see the closed rate.
alter table reward_requests
  add column if not exists closed_rate numeric(14,2),
  add column if not exists closed_rate_currency text not null default 'INR';

-- Constrain the currency to the two we support (guarded so re-runs are safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reward_requests_closed_rate_currency_chk'
  ) then
    alter table reward_requests
      add constraint reward_requests_closed_rate_currency_chk
      check (closed_rate_currency in ('INR', 'USD'));
  end if;
end $$;
