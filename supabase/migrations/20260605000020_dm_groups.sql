create table if not exists public.dm_groups (
  id           uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name         text not null,
  avatar_url   text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.dm_group_members (
  group_id  uuid not null references public.dm_groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.dm_group_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.dm_groups(id) on delete cascade,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  content      text not null default '',
  attachment_url  text,
  attachment_name text,
  attachment_type text,
  reactions    jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists dm_groups_ws_idx on public.dm_groups(workspace_id);
create index if not exists dm_group_messages_group_idx on public.dm_group_messages(group_id, created_at desc);
create index if not exists dm_group_members_user_idx on public.dm_group_members(user_id);

alter table public.dm_groups enable row level security;
alter table public.dm_group_members enable row level security;
alter table public.dm_group_messages enable row level security;

create policy "Group members can view groups"
  on public.dm_groups for select
  using (exists(select 1 from public.dm_group_members where group_id = id and user_id = auth.uid()));

create policy "Members can create groups"
  on public.dm_groups for insert
  with check (auth.uid() is not null);

create policy "Group members can view members"
  on public.dm_group_members for select
  using (exists(select 1 from public.dm_group_members gm where gm.group_id = group_id and gm.user_id = auth.uid()));

create policy "Group creator can add members"
  on public.dm_group_members for insert
  with check (auth.uid() is not null);

create policy "Group members can view messages"
  on public.dm_group_messages for select
  using (exists(select 1 from public.dm_group_members where group_id = dm_group_messages.group_id and user_id = auth.uid()));

create policy "Group members can send messages"
  on public.dm_group_messages for insert
  with check (sender_id = auth.uid() and exists(select 1 from public.dm_group_members where group_id = dm_group_messages.group_id and user_id = auth.uid()));

create policy "Sender can update own messages"
  on public.dm_group_messages for update
  using (sender_id = auth.uid() or exists(select 1 from public.dm_group_members where group_id = dm_group_messages.group_id and user_id = auth.uid()));

alter publication supabase_realtime add table public.dm_group_messages;
alter table public.dm_group_messages replica identity full;
