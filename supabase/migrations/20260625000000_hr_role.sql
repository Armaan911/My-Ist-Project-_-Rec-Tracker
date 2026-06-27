-- ============================================================
--  Add the 'hr' login role.
--  HR users get a dedicated dashboard (/hr) where they approve or
--  deny incentive requests, set the amount, and trigger the payroll
--  email. Kept in its own migration so the new enum value is committed
--  before any later migration / policy references it.
-- ============================================================

alter type user_role add value if not exists 'hr';
