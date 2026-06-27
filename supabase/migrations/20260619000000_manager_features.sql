-- =============================================================
-- Manager feature pack
--   1) Rename "Domestic" division -> "Internal Hiring"
--   2) messages table (manager -> recruiter notifications) + RLS
--   3) Restrict requirement creation to admins only (managers allocate, not create)
-- Run this AFTER the init migration. Safe to run once.
-- =============================================================

-- ---------- 1) Rename Domestic -> Internal Hiring ----------
update divisions set name = 'Internal Hiring' where code = 'DOM';

-- ---------- 2) MESSAGES (manager/admin -> recruiter inbox) ----------
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid references profiles(id),
  recipient_id uuid not null references profiles(id),
  division_id  uuid references divisions(id),
  subject      text,
  body         text not null,
  is_broadcast boolean not null default false,  -- sent to "everyone" in one shot
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_messages_recipient on messages (recipient_id, is_read);

alter table messages enable row level security;

-- recipient reads own; sender & admins/managers can read what they sent / oversee
drop policy if exists messages_select on messages;
create policy messages_select on messages for select using (
  recipient_id = auth.uid()
  or sender_id = auth.uid()
  or auth_role() in ('admin','manager')
);

-- recipient marks their own message read (or admin)
drop policy if exists messages_update on messages;
create policy messages_update on messages for update
  using (recipient_id = auth.uid() or auth_role() = 'admin')
  with check (recipient_id = auth.uid() or auth_role() = 'admin');

-- managers/admins may insert; the server action also sends via the service role
drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert with check (auth_role() in ('admin','manager'));

-- ---------- 3) Requirement creation = admin only ----------
-- Managers can still update/allocate, but only admins create new requirements.
drop policy if exists req_write on requirements;
drop policy if exists req_insert on requirements;
drop policy if exists req_update on requirements;
drop policy if exists req_delete on requirements;

create policy req_insert on requirements for insert
  with check (auth_role() = 'admin');
create policy req_update on requirements for update
  using (auth_role() in ('admin','manager')) with check (auth_role() in ('admin','manager'));
create policy req_delete on requirements for delete
  using (auth_role() = 'admin');
