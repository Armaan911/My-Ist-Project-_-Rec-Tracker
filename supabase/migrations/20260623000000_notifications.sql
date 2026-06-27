-- ============================================================
--  Per-user notification feed (the bell icon).
--  Created server-side via the service role (so one user can notify another),
--  read & dismissed by the recipient. Inserts via service role bypass RLS.
-- ============================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,  -- the RECIPIENT
  type        text not null,            -- 'approval_request' | 'approval_approved' | 'approval_rejected' | 'badge' | 'daily_reminder' | 'message'
  title       text not null,
  body        text,
  link        text,                     -- in-app href to open when clicked
  is_read     boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Fast "my unread, newest first" lookups for the bell.
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on notifications (user_id) where is_read = false;

alter table notifications enable row level security;

-- Recipients read their own.
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());

-- Recipients mark their own as read.
drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Recipients dismiss (delete) their own.
drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications
  for delete using (user_id = auth.uid());

-- NOTE: no INSERT policy on purpose — all writes go through the service-role
-- client (server actions / cron), which bypasses RLS.
