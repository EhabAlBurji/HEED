-- Sync the Wrike-style task fields (status workflow, assignee, start date) that
-- the app added but the tasks table never had — without these columns the app
-- can't push/pull them, so they never sync between desktop and web.
alter table public.tasks
  add column if not exists start_date date,
  add column if not exists workflow_status text,
  add column if not exists assignee_id text;
