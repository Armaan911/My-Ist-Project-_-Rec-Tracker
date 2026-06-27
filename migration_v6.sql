-- =============================================================
-- MIGRATION v6 — profile + candidate photos
-- Run AFTER migration_v5.sql in the Supabase SQL editor.
--
--  1) profiles.avatar_url          — recruiter / user profile photo
--  2) submissions.candidate_photo_url — candidate photo on a submission
--  3) Two PUBLIC storage buckets ('avatars', 'candidates') + policies so signed-in
--     users can upload and anyone can view the images.
--
-- If the storage policy statements error in your project (some projects restrict
-- policy creation on storage.objects), just create the two buckets by hand in
-- Supabase → Storage → New bucket (name them 'avatars' and 'candidates', mark PUBLIC)
-- and skip the storage section below — the columns above are all the app needs.
-- =============================================================

alter table profiles    add column if not exists avatar_url           text;
alter table submissions add column if not exists candidate_photo_url  text;

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('candidates', 'candidates', true)
  on conflict (id) do update set public = true;

-- ---------- Storage policies (public read, authenticated write) ----------
drop policy if exists "media_public_read"  on storage.objects;
drop policy if exists "media_auth_insert"  on storage.objects;
drop policy if exists "media_auth_update"  on storage.objects;
drop policy if exists "media_auth_delete"  on storage.objects;

create policy "media_public_read" on storage.objects
  for select using (bucket_id in ('avatars', 'candidates'));
create policy "media_auth_insert" on storage.objects
  for insert with check (bucket_id in ('avatars', 'candidates') and auth.role() = 'authenticated');
create policy "media_auth_update" on storage.objects
  for update using (bucket_id in ('avatars', 'candidates') and auth.role() = 'authenticated');
create policy "media_auth_delete" on storage.objects
  for delete using (bucket_id in ('avatars', 'candidates') and auth.role() = 'authenticated');
