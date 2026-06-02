-- =========================================================================
-- Heed — paste this whole file into Supabase → SQL Editor → Run (one time).
-- Creates: notifications, task_comments, profiles.access_status,
--          boards, canvas_nodes, canvas_edges (+ RLS + realtime),
--          and the public canvas-media Storage bucket.
-- =========================================================================

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


-- =========================================================================
-- Heed — Canvas / Boards sync (shared visual boards across members)
-- =========================================================================
-- Boards + their nodes/edges sync per workspace. Media (images/video/voice)
-- is uploaded to the `canvas-media` Storage bucket and stored as a URL inside
-- the node `data` JSON (never base64 in Postgres). RLS + realtime mirror the
-- rest of the schema.
-- =========================================================================

-- ────────────────────────────────────────────────────────────────────
-- BOARDS
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id                   text primary key,
  workspace_id         text not null references public.workspaces(id) on delete cascade,
  project_id           text references public.projects(id) on delete set null,
  name                 text not null,
  cover                text,
  shared_workspace_ids text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index boards_ws_idx on public.boards(workspace_id);
alter table public.boards enable row level security;
create policy "Members can view boards"
  on public.boards for select using (public.is_workspace_accessible(workspace_id));
create policy "Members can manage boards"
  on public.boards for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- CANVAS NODES
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.canvas_nodes (
  id            text primary key,
  space_id      text not null,            -- = board id
  project_id    text,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  type          text not null,
  x             double precision not null default 0,
  y             double precision not null default 0,
  width         double precision not null default 200,
  height        double precision not null default 120,
  z             integer not null default 0,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index canvas_nodes_space_idx on public.canvas_nodes(space_id);
create index canvas_nodes_ws_idx    on public.canvas_nodes(workspace_id);
alter table public.canvas_nodes enable row level security;
create policy "Members can view canvas nodes"
  on public.canvas_nodes for select using (public.is_workspace_accessible(workspace_id));
create policy "Members can manage canvas nodes"
  on public.canvas_nodes for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- CANVAS EDGES
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.canvas_edges (
  id            text primary key,
  space_id      text not null,
  project_id    text,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  source        text not null,
  target        text not null,
  label         text,
  created_at    timestamptz not null default now()
);
create index canvas_edges_space_idx on public.canvas_edges(space_id);
alter table public.canvas_edges enable row level security;
create policy "Members can view canvas edges"
  on public.canvas_edges for select using (public.is_workspace_accessible(workspace_id));
create policy "Members can manage canvas edges"
  on public.canvas_edges for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- updated_at triggers (reuse public.set_updated_at)
create trigger boards_set_updated_at
  before update on public.boards for each row execute function public.set_updated_at();
create trigger canvas_nodes_set_updated_at
  before update on public.canvas_nodes for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- Realtime
-- ────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.canvas_nodes;
alter publication supabase_realtime add table public.canvas_edges;

-- ────────────────────────────────────────────────────────────────────
-- STORAGE: media bucket for canvas images/video/voice
-- ────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('canvas-media', 'canvas-media', true)
  on conflict (id) do nothing;

create policy "Public read canvas media"
  on storage.objects for select
  using (bucket_id = 'canvas-media');
create policy "Authenticated upload canvas media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'canvas-media');
create policy "Authenticated update canvas media"
  on storage.objects for update to authenticated
  using (bucket_id = 'canvas-media');
