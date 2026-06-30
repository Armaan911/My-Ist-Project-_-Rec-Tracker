-- Candidate (submission) status changes:
--  • "Internally Submitted" → "Submitted in RR"
--  • remove "Technical Interview Conducted" and "Rejected in Tech" from all dropdowns
--    (deactivate, not delete, to preserve history), and move any submissions sitting at
--    those statuses to the nearest remaining one.
update submission_statuses set label = 'Submitted in RR' where code = 'internal_submitted';

update submissions set current_status_id = (select id from submission_statuses where code = 'client_submitted')
  where current_status_id = (select id from submission_statuses where code = 'tech_interview');
update submissions set current_status_id = (select id from submission_statuses where code = 'rejected_internal')
  where current_status_id = (select id from submission_statuses where code = 'rejected_tech');

update submission_statuses set is_active = false where code in ('tech_interview', 'rejected_tech');
