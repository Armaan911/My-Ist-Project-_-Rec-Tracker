-- Contract-staffing revenue: a closure earns a monthly profit for the contract duration.
-- Total revenue = monthly_profit * contract_months (stored into revenue_value for rollups).
alter table reward_requests
  add column if not exists monthly_profit   numeric(14,2),
  add column if not exists contract_months  int;
