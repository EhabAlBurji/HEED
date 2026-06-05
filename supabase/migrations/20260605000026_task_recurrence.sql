-- Add recurrence and assignee_id columns to tasks table
alter table public.tasks
  add column if not exists recurrence text default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly'));

alter table public.tasks
  add column if not exists assignee_id text;
