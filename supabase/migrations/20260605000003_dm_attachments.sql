-- =========================================================================
-- Heed — DM attachment support + storage bucket + fix profile search policy
-- =========================================================================

-- 1. Add attachment columns to dm_messages
alter table public.dm_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- 2. Storage bucket for DM attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-attachments',
  'dm-attachments',
  false,
  10485760,   -- 10 MB
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf',
        'text/plain','application/zip','video/mp4']
) on conflict (id) do nothing;

create policy "Authenticated users upload DM attachments"
  on storage.objects for insert
  with check (bucket_id = 'dm-attachments' and auth.uid() is not null);

create policy "Authenticated users view DM attachments"
  on storage.objects for select
  using (bucket_id = 'dm-attachments' and auth.uid() is not null);

-- 3. Widen the profile-search policy to include early_access users
--    (so any registered non-rejected user can be found for DMs)
drop policy if exists "Authenticated users can search approved profiles" on public.profiles;
create policy "Authenticated users can search approved profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and access_status in ('early_access', 'approved')
  );
