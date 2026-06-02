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
