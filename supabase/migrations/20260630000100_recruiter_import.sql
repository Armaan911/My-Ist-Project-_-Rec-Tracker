-- Admin-granted permission: lets a recruiter bulk-import their previous submissions from a
-- sheet/CSV (off by default; admins grant or revoke it per recruiter).
alter table profiles add column if not exists can_import_submissions boolean not null default false;
