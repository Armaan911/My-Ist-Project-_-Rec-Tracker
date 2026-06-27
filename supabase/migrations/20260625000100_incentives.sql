-- ============================================================
--  Incentives on closure rewards.
--  Extends reward_requests so HR can record a payout amount + currency
--  (INR/USD), a decision comment, who decided, and when the payroll
--  ("account manager") email went out.
--
--  Status flow (unchanged shape, richer data):
--    pending_manager -> manager_confirmed (on HR's "My Plate")
--      -> hr_approved  (HR set amount+currency; payroll emailed)
--      -> hr_rejected  (HR set a comment; manager + recruiter notified)
--    hr_approved -> initiated  (marked "Paid" once payroll processes)
--    pending_manager -> rejected (manager declined before HR)
-- ============================================================

alter table reward_requests
  add column if not exists amount            numeric(12,2),
  add column if not exists currency          text check (currency in ('INR','USD')),
  add column if not exists hr_comment        text,
  add column if not exists hr_id             uuid references profiles(id),
  add column if not exists payroll_emailed_at timestamptz;

-- HR reads every incentive request (org-wide, like admin). Writes still go
-- through service-role server actions; this only widens SELECT.
drop policy if exists reward_select on reward_requests;
create policy reward_select on reward_requests for select using (
  recruiter_id = auth.uid() or auth_role()::text in ('admin','manager','hr')
);

-- Payroll / "account manager" recipient for approved-incentive emails
-- (admin-editable on the Configuration page, mirrors hr_email).
insert into app_settings (key, value, description)
values ('account_manager_email', '{"email":""}'::jsonb, 'Payroll / account-manager recipient for approved incentive emails')
on conflict (key) do nothing;
