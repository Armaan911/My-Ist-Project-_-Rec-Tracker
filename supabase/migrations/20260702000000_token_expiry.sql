-- Incentive approval tokens should not be valid forever. Add an expiry the app sets on mint
-- and checks on use (defense-in-depth behind single-use deletion).
alter table reward_approval_tokens add column if not exists expires_at timestamptz;
