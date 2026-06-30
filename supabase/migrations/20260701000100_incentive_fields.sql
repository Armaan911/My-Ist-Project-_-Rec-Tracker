-- Extra fields recruiters fill on an incentive request.
alter table reward_requests
  add column if not exists job_title     text,
  add column if not exists client_name   text,
  add column if not exists vendor_name   text,
  add column if not exists rate_closed    text,
  add column if not exists other_details  text;
