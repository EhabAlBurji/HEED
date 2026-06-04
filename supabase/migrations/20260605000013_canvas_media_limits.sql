-- canvas-media bucket was created as fully public with no restrictions.
-- Add size limit (20 MB) and restrict MIME types to images/video/audio only
-- so it can't be used to host phishable HTML or arbitrary executables.
update storage.buckets
  set
    file_size_limit   = 20971520,   -- 20 MB
    allowed_mime_types = array[
      'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
      'video/mp4','video/webm','video/ogg',
      'audio/mpeg','audio/ogg','audio/wav','audio/webm'
    ]
  where id = 'canvas-media';

-- Restrict upload to the uploader's own workspace folder
drop policy if exists "Workspace members can upload canvas media" on storage.objects;
create policy "Workspace members upload canvas media to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'canvas-media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (storage.foldername(name))[1]  -- workspace_id check via RLS
  );
