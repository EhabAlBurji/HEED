-- =====================================================================
-- Mindora — initial Supabase schema
-- =====================================================================
-- Tables mirror the in-app Zustand stores 1:1 so the sync layer can
-- map back and forth without translation beyond camel/snake case.
--
-- Conventions:
--   * snake_case columns
--   * text PRIMARY KEY (clients generate IDs locally, then push)
--   * timestamptz for all timestamps
--   * RLS enabled on every user-data table
--   * `personal` workspace auto-created per user via trigger
--
-- ⚠️  SAFE TO RE-RUN: drops everything Mindora-related first, then
--     recreates. Existing data in these tables WILL BE WIPED. This is
--     fine in development; for production use proper migrations.
-- =====================================================================

-- ────────────────────────────────────────────────────────────────────
-- 0. TEARDOWN — drop existing objects so the script is re-runnable
-- ────────────────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_workspace_accessible(text) cascade;

-- Tables (cascade clears their policies, indexes, triggers, FKs)
drop table if exists public.meetings           cascade;
drop table if exists public.schedule_posts     cascade;
drop table if exists public.tasks              cascade;
drop table if exists public.tags               cascade;
drop table if exists public.categories         cascade;
drop table if exists public.projects           cascade;
drop table if exists public.workspace_members  cascade;
drop table if exists public.workspaces         cascade;
drop table if exists public.profiles           cascade;

-- ────────────────────────────────────────────────────────────────────
-- 1. PROFILES (extends auth.users with name + avatar)
-- ────────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────────
-- 2. WORKSPACES
-- ────────────────────────────────────────────────────────────────────
create table public.workspaces (
  id            text primary key,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('personal','team')),
  color         text not null,
  member_count  integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces(owner_id);

alter table public.workspaces enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- 3. WORKSPACE MEMBERS (junction)
-- ────────────────────────────────────────────────────────────────────
create table public.workspace_members (
  id            text primary key,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  name          text not null,
  email         text,
  role          text not null check (role in ('owner','member')),
  added_at      timestamptz not null default now()
);

create index workspace_members_ws_idx on public.workspace_members(workspace_id);
create index workspace_members_user_idx on public.workspace_members(user_id);

alter table public.workspace_members enable row level security;

-- Helper: check if current user can access a workspace (owner OR member)
create or replace function public.is_workspace_accessible(ws_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.workspaces where id = ws_id and owner_id = auth.uid()
  ) or exists(
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Workspace policies (referencing the helper)
create policy "Members can view their workspaces"
  on public.workspaces for select
  using (owner_id = auth.uid() or public.is_workspace_accessible(id));

create policy "Owners can update their workspaces"
  on public.workspaces for update
  using (owner_id = auth.uid());

create policy "Owners can delete their workspaces"
  on public.workspaces for delete
  using (owner_id = auth.uid());

create policy "Users can create workspaces"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

-- Workspace member policies
create policy "Members can view members of accessible workspaces"
  on public.workspace_members for select
  using (public.is_workspace_accessible(workspace_id));

create policy "Owners can manage workspace members"
  on public.workspace_members for all
  using (
    exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  )
  with check (
    exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────
-- 4. PROJECTS
-- ────────────────────────────────────────────────────────────────────
create table public.projects (
  id                    text primary key,
  workspace_id          text not null references public.workspaces(id) on delete cascade,
  name                  text not null,
  color                 text not null,
  icon                  text not null,
  icon_url              text,
  type                  text not null check (type in ('general','video','design')),
  shared_workspace_ids  text[] not null default '{}',
  position              integer not null default 0,
  created_at            timestamptz not null default now()
);

create index projects_workspace_idx on public.projects(workspace_id);

alter table public.projects enable row level security;

create policy "Members can view projects in their workspaces"
  on public.projects for select
  using (
    public.is_workspace_accessible(workspace_id)
    or exists(
      select 1 from unnest(shared_workspace_ids) ws_id
      where public.is_workspace_accessible(ws_id)
    )
  );

create policy "Members can manage projects in their workspaces"
  on public.projects for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 5. CATEGORIES
-- ────────────────────────────────────────────────────────────────────
create table public.categories (
  id            text primary key,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name          text not null,
  color         text not null,
  type          text not null check (type in ('general','video','design')),
  description   text,
  created_at    timestamptz not null default now()
);

create index categories_workspace_idx on public.categories(workspace_id);

alter table public.categories enable row level security;

create policy "Members can view categories"
  on public.categories for select using (public.is_workspace_accessible(workspace_id));

create policy "Members can manage categories"
  on public.categories for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 6. TAGS
-- ────────────────────────────────────────────────────────────────────
create table public.tags (
  id            text primary key,
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name          text not null,
  color         text not null,
  description   text,
  created_at    timestamptz not null default now()
);

create index tags_workspace_idx on public.tags(workspace_id);

alter table public.tags enable row level security;

create policy "Members can view tags"
  on public.tags for select using (public.is_workspace_accessible(workspace_id));

create policy "Members can manage tags"
  on public.tags for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 7. TASKS
-- ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id                  text primary key,
  workspace_id        text not null references public.workspaces(id) on delete cascade,
  project_id          text references public.projects(id) on delete set null,
  category_id         text references public.categories(id) on delete set null,
  title               text not null,
  notes               text not null default '',
  tag_ids             text[] not null default '{}',
  priority            text not null check (priority in ('low','medium','high','urgent')),
  status              text not null check (status in ('todo','in_progress','done','cancelled')),
  "column"            text not null check ("column" in ('backlog','this_week','today','done')),
  position            integer not null default 0,
  estimated_minutes   integer,
  actual_minutes      integer not null default 0,
  deadline            date,
  video_stage         text check (video_stage in ('idea','script','filming','editing','scheduled','published')),
  links               jsonb not null default '[]'::jsonb,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tasks_workspace_idx on public.tasks(workspace_id);
create index tasks_project_idx   on public.tasks(project_id);
create index tasks_status_idx    on public.tasks(workspace_id, status);
create index tasks_column_idx    on public.tasks(workspace_id, "column");

alter table public.tasks enable row level security;

create policy "Members can view tasks"
  on public.tasks for select using (public.is_workspace_accessible(workspace_id));

create policy "Members can manage tasks"
  on public.tasks for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 8. SCHEDULE POSTS (content scheduling)
-- ────────────────────────────────────────────────────────────────────
create table public.schedule_posts (
  id                  text primary key,
  workspace_id        text not null references public.workspaces(id) on delete cascade,
  task_id             text references public.tasks(id) on delete set null,
  title               text not null,
  notes               text not null default '',
  platforms           text[] not null default '{}',
  tags                text[] not null default '{}',
  links               jsonb not null default '[]'::jsonb,
  scheduled_date      text,  -- "MM-DD" format (no year, recurring-friendly)
  scheduled_time      text,  -- "HH:MM"
  "column"            text not null check ("column" in ('content','this_week','today','published')),
  position            integer not null default 0,
  preview_image_url   text,
  created_at          timestamptz not null default now()
);

create index schedule_posts_workspace_idx on public.schedule_posts(workspace_id);
create index schedule_posts_task_idx       on public.schedule_posts(task_id);

alter table public.schedule_posts enable row level security;

create policy "Members can view schedule posts"
  on public.schedule_posts for select using (public.is_workspace_accessible(workspace_id));

create policy "Members can manage schedule posts"
  on public.schedule_posts for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 9. MEETINGS
-- ────────────────────────────────────────────────────────────────────
create table public.meetings (
  id                text primary key,
  workspace_id      text not null references public.workspaces(id) on delete cascade,
  title             text not null,
  date              date not null,
  time              text,    -- HH:MM
  duration_minutes  integer,
  location          text not null default '',
  notes             text not null default '',
  attendees         text[] not null default '{}',
  meeting_link      text,
  source            text not null default 'manual' check (source in ('manual','google')),
  external_id       text,
  created_at        timestamptz not null default now()
);

create index meetings_workspace_date_idx on public.meetings(workspace_id, date);

alter table public.meetings enable row level security;

create policy "Members can view meetings"
  on public.meetings for select using (public.is_workspace_accessible(workspace_id));

create policy "Members can manage meetings"
  on public.meetings for all
  using (public.is_workspace_accessible(workspace_id))
  with check (public.is_workspace_accessible(workspace_id));

-- ────────────────────────────────────────────────────────────────────
-- 10. updated_at trigger (reusable for any table with updated_at column)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- 11. handle_new_user — auto-create profile + personal workspace
--     on auth.users insert
-- ────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  personal_ws_id text;
begin
  -- Create profile row
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  -- Create a default personal workspace
  personal_ws_id := 'ws_' || substr(replace(new.id::text, '-', ''), 1, 12);
  insert into public.workspaces (id, owner_id, name, type, color, member_count)
  values (personal_ws_id, new.id, 'Personal', 'personal', '#6735E1', 1);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────
-- 12. Realtime — enable for live multi-device sync
-- ────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.tags;
alter publication supabase_realtime add table public.schedule_posts;
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.workspace_members;
