-- =========================================================================
-- Heed — Team collaboration: notifications, task comments, early access
-- =========================================================================
-- Cross-user notifications (workspace invites, @mentions), per-task comment
-- threads synced across members, and an early-access gate on profiles.
-- Mirrors the RLS + realtime patterns of the initial schema.
-- =========================================================================

-- ────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS  (delivered to a specific recipient)
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id              text primary key,
  recipient_id    uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('workspace_invite','mention','assignment','info')),
  title           text not null,
  body            text,
  workspace_id    text,            -- invite payload
  workspace_name  text,
  workspace_color text,
  task_id         text,            -- mention/assignment payload
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications(recipient_id);

alter table public.notifications enable row level security;

-- A user only ever sees / mutates their own notifications. Inserts are done
-- by Edge Functions with the service role (which bypasses RLS), so there is
-- intentionally no client INSERT policy — clients can't spam each other.
create policy "Recipients can view their notifications"
  on public.notifications for select using (recipient_id = auth.uid());
create policy "Recipients can update their notifications"
  on public.notifications for update using (recipient_id = auth.uid());
create policy "Recipients can delete their notifications"
  on public.notifications for delete using (recipient_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────
-- TASK COMMENTS  (visible to everyone with access to the workspace)
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.task_comments (
  id            text primary key,
  task_id       text not null,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  author_id     uuid references auth.users(id) on delete set null,
  author_name   text not null,
  author_avatar text,
  body          text not null,
  created_at    timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments(task_id);
create index task_comments_ws_idx   on public.task_comments(workspace_id);

alter table public.task_comments enable row level security;

create policy "Members can view task comments"
  on public.task_comments for select using (public.is_workspace_accessible(workspace_id));
create policy "Members can add task comments"
  on public.task_comments for insert with check (public.is_workspace_accessible(workspace_id));
create policy "Authors can delete their comments"
  on public.task_comments for delete using (author_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────
-- EARLY ACCESS  (gate new signups until an admin approves them)
-- ────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists access_status text not null default 'early_access'
  check (access_status in ('early_access','approved'));

-- ────────────────────────────────────────────────────────────────────
-- Realtime
-- ────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.task_comments;
