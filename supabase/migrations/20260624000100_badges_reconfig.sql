-- Reconfigure the badge catalog to exactly 7: four closure milestones + three
-- client-submission milestones. Deactivate everything else first; idempotent.
update badges set is_active = false;

insert into badges (code, name, description, icon, color, rule, threshold, period, is_repeatable, is_active, sort_order) values
  ('closure_1',      'First Closure',   'Landed your very first closure.',        '⭐', '#22c55e', 'closures_total',           1,   'once', false, true, 10),
  ('closure_3',      'Hat-Trick',       'Three closures in the bag.',             '🎩', '#f43f5e', 'closures_total',           3,   'once', false, true, 20),
  ('closure_7',      'Lucky Seven',     'Seven closures — on a roll.',            '🍀', '#8b5cf6', 'closures_total',           7,   'once', false, true, 30),
  ('closure_12',     'Recruiter Guru',  'Twelve closures — true mastery.',        '👑', '#d97706', 'closures_total',           12,  'once', false, true, 40),
  ('client_sub_4',   'Client Opener',   'Four submissions made to clients.',      '🤝', '#0ea5e9', 'client_submissions_total', 4,   'once', false, true, 50),
  ('client_sub_30',  'Client Champion', 'Thirty client submissions strong.',      '🥇', '#16a34a', 'client_submissions_total', 30,  'once', false, true, 60),
  ('client_sub_155', 'Client Legend',   'A staggering 155 client submissions.',   '🏅', '#db2777', 'client_submissions_total', 155, 'once', false, true, 70)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, color = excluded.color,
  rule = excluded.rule, threshold = excluded.threshold, period = excluded.period,
  is_repeatable = excluded.is_repeatable, is_active = excluded.is_active, sort_order = excluded.sort_order;
