-- Sync chat attachments (images / voice / video / files). The media itself is
-- uploaded to the canvas-media Storage bucket; this column stores the lightweight
-- attachment metadata ({ kind, src: <public url>, name }) as JSON.
alter table public.task_comments
  add column if not exists attachments jsonb;
