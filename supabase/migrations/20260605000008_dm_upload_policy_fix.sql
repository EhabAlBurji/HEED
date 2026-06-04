-- Fix security: DM attachment upload policy allowed any authenticated user
-- to upload to any path. Restrict each user to their own folder only.

drop policy if exists "Authenticated users upload DM attachments" on storage.objects;

create policy "Users upload DM attachments to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'dm-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
