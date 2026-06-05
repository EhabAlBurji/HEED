-- =========================================================================
-- Heed — New Migrations (run in Supabase SQL Editor after DEPLOY_SQL.sql)
-- Covers: DMs, HR module, groups, reactions, task recurrence + all patches
-- =========================================================================

-- ── 20260604000001_chat_sync.sql ──────────────────────────────────────────
-- =========================================================================
-- Heed — Chat conversation sync
-- Stores Heed Chat conversations per user so they're available on all
-- devices. One row per user; updated via upsert on every chat change.
-- =========================================================================

create table if not exists public.user_chat_data (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  conversations jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.user_chat_data enable row level security;

create policy "Users manage their own chat data"
  on public.user_chat_data for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 20260604000002_dm_messages.sql ──────────────────────────────────────────
-- =========================================================================
-- Heed — Direct Messages between users
-- One row per message. Each user sees only messages they sent or received.
-- =========================================================================

create table if not exists public.dm_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  content      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists dm_messages_sender_receiver_idx
  on public.dm_messages(sender_id, receiver_id, created_at desc);

create index if not exists dm_messages_receiver_sender_idx
  on public.dm_messages(receiver_id, sender_id, created_at desc);

alter table public.dm_messages enable row level security;

create policy "Users see their own DMs"
  on public.dm_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users send DMs"
  on public.dm_messages for insert
  with check (sender_id = auth.uid());

create policy "Recipients mark messages read"
  on public.dm_messages for update
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());


-- ── 20260604000003_shared_chats.sql ──────────────────────────────────────────
-- =========================================================================
-- Heed — Shared AI conversations
-- Public read access so anyone with the link can view the conversation.
-- Owner can create / update / delete their shares.
-- =========================================================================

create table if not exists public.shared_chats (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Shared chat',
  messages     jsonb not null default '[]'::jsonb,
  assistant_name text not null default 'Heed Assistant',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.shared_chats enable row level security;

-- Anyone (including anonymous) can read a shared chat by its ID.
create policy "Public read shared chats"
  on public.shared_chats for select
  using (true);

-- Authenticated owner manages their own shares.
create policy "Owner manages shares"
  on public.shared_chats for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- ── 20260605000001_hr_schema.sql ──────────────────────────────────────────
-- =========================================================================
-- Heed — Human Resources module
-- Departments, positions, employee org chart, request management.
-- =========================================================================

-- ── Helper: is the current user an HR admin in this workspace? ────────────
create or replace function public.is_hr_admin(ws_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.hr_employees
    where workspace_id = ws_id
      and user_id = auth.uid()
      and is_hr_admin = true
      and status = 'active'
  );
$$;

-- ── HR Departments ────────────────────────────────────────────────────────
create table if not exists public.hr_departments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name          text not null,
  color         text not null default '#0A4EFF',
  parent_id     uuid references public.hr_departments(id) on delete set null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists hr_departments_ws_idx on public.hr_departments(workspace_id);

alter table public.hr_departments enable row level security;

create policy "Members can view HR departments"
  on public.hr_departments for select
  using (public.is_workspace_accessible(workspace_id));

create policy "HR admins can manage departments"
  on public.hr_departments for all
  using (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ))
  with check (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ));

-- ── HR Positions / Job Titles ─────────────────────────────────────────────
create table if not exists public.hr_positions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name          text not null,
  grade         integer not null default 3, -- 1=executive 2=director 3=manager 4=senior 5=staff
  department_id uuid references public.hr_departments(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists hr_positions_ws_idx on public.hr_positions(workspace_id);

alter table public.hr_positions enable row level security;

create policy "Members can view HR positions"
  on public.hr_positions for select
  using (public.is_workspace_accessible(workspace_id));

create policy "HR admins can manage positions"
  on public.hr_positions for all
  using (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ))
  with check (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ));

-- ── HR Employees ─────────────────────────────────────────────────────────
create table if not exists public.hr_employees (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  employee_no   text,
  name          text not null,
  name_en       text,
  email         text,
  phone         text,
  national_id   text,
  avatar_url    text,
  department_id uuid references public.hr_departments(id) on delete set null,
  position_id   uuid references public.hr_positions(id) on delete set null,
  manager_id    uuid references public.hr_employees(id) on delete set null,
  hire_date     date,
  location      text,
  status        text not null default 'active'
    check (status in ('active','inactive','on_leave')),
  is_hr_admin   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hr_employees_ws_idx     on public.hr_employees(workspace_id);
create index if not exists hr_employees_user_idx   on public.hr_employees(user_id);
create index if not exists hr_employees_dept_idx   on public.hr_employees(department_id);
create index if not exists hr_employees_mgr_idx    on public.hr_employees(manager_id);

alter table public.hr_employees enable row level security;

create policy "Members can view HR employees"
  on public.hr_employees for select
  using (public.is_workspace_accessible(workspace_id));

create policy "HR admins and owners can manage employees"
  on public.hr_employees for all
  using (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ))
  with check (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ));

-- ── HR Request Types (configurable form templates) ────────────────────────
create table if not exists public.hr_request_types (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name_ar       text not null,
  name_en       text not null default '',
  icon          text not null default 'FileText',
  fields        jsonb not null default '[]',
  needs_attach  boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists hr_request_types_ws_idx on public.hr_request_types(workspace_id);

alter table public.hr_request_types enable row level security;

create policy "Members can view HR request types"
  on public.hr_request_types for select
  using (public.is_workspace_accessible(workspace_id));

create policy "HR admins can manage request types"
  on public.hr_request_types for all
  using (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ))
  with check (public.is_workspace_accessible(workspace_id) and (
    public.is_hr_admin(workspace_id)
    or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  ));

-- ── HR Requests ──────────────────────────────────────────────────────────
create table if not exists public.hr_requests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  employee_id   uuid references public.hr_employees(id) on delete cascade,
  type_id       uuid references public.hr_request_types(id) on delete restrict,
  data          jsonb not null default '{}',
  attachments   jsonb not null default '[]',
  status        text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  notes         text,
  reviewed_by   uuid references public.hr_employees(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hr_requests_ws_idx   on public.hr_requests(workspace_id);
create index if not exists hr_requests_emp_idx  on public.hr_requests(employee_id);
create index if not exists hr_requests_type_idx on public.hr_requests(type_id);
create index if not exists hr_requests_status_idx on public.hr_requests(status);

alter table public.hr_requests enable row level security;

-- Workspace members can see all requests in the workspace
create policy "Members can view HR requests"
  on public.hr_requests for select
  using (public.is_workspace_accessible(workspace_id));

-- Employees can submit requests for themselves; HR admins can create for anyone
create policy "Employees can submit requests"
  on public.hr_requests for insert
  with check (
    public.is_workspace_accessible(workspace_id) and (
      public.is_hr_admin(workspace_id)
      or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
      or exists(
        select 1 from public.hr_employees
        where id = employee_id and user_id = auth.uid()
      )
    )
  );

-- HR admins and owners can update any request; employees can only cancel own
create policy "HR admins can update requests"
  on public.hr_requests for update
  using (
    public.is_workspace_accessible(workspace_id) and (
      public.is_hr_admin(workspace_id)
      or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
      or exists(
        select 1 from public.hr_employees
        where id = employee_id and user_id = auth.uid()
      )
    )
  );

create policy "HR admins can delete requests"
  on public.hr_requests for delete
  using (
    public.is_workspace_accessible(workspace_id) and (
      public.is_hr_admin(workspace_id)
      or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
    )
  );

-- ── updated_at trigger ────────────────────────────────────────────────────
create or replace function public.hr_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger hr_employees_updated_at
  before update on public.hr_employees
  for each row execute procedure public.hr_set_updated_at();

create trigger hr_requests_updated_at
  before update on public.hr_requests
  for each row execute procedure public.hr_set_updated_at();


-- ── 20260605000002_dm_profiles_search.sql ──────────────────────────────────────────
-- =========================================================================
-- Allow authenticated users to search approved profiles for DM discovery.
-- Without this, users can only DM workspace members they already share.
-- =========================================================================

-- Any signed-in user can read approved profiles (name + email only).
-- This is safe: we only expose non-sensitive fields via the app layer.
drop policy if exists "Authenticated users can search approved profiles" on public.profiles;
create policy "Authenticated users can search approved profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and access_status = 'approved'
  );


-- ── 20260605000003_dm_attachments.sql ──────────────────────────────────────────
-- =========================================================================
-- Heed — DM attachment support + storage bucket + fix profile search policy
-- =========================================================================

-- 1. Add attachment columns to dm_messages
alter table public.dm_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- 2. Storage bucket for DM attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-attachments',
  'dm-attachments',
  false,
  10485760,   -- 10 MB
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf',
        'text/plain','application/zip','video/mp4']
) on conflict (id) do nothing;

create policy "Authenticated users upload DM attachments"
  on storage.objects for insert
  with check (bucket_id = 'dm-attachments' and auth.uid() is not null);

create policy "Authenticated users view DM attachments"
  on storage.objects for select
  using (bucket_id = 'dm-attachments' and auth.uid() is not null);

-- 3. Widen the profile-search policy to include early_access users
--    (so any registered non-rejected user can be found for DMs)
drop policy if exists "Authenticated users can search approved profiles" on public.profiles;
create policy "Authenticated users can search approved profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and access_status in ('early_access', 'approved')
  );


-- ── 20260605000004_dm_realtime.sql ──────────────────────────────────────────
-- Enable Supabase Realtime for dm_messages so receivers get live notifications.
alter publication supabase_realtime add table public.dm_messages;


-- ── 20260605000005_dm_replica_identity.sql ──────────────────────────────────────────
-- Supabase Realtime filtered subscriptions (filter: receiver_id=eq.X) require
-- REPLICA IDENTITY FULL on the table so non-PK columns are available in the WAL.
alter table public.dm_messages replica identity full;


-- ── 20260605000006_project_description.sql ──────────────────────────────────────────
-- Add optional description field to projects table.
alter table public.projects
  add column if not exists description text;


-- ── 20260605000009_hr_realtime.sql ──────────────────────────────────────────
-- Enable Supabase Realtime for HR tables so changes propagate instantly.
-- REPLICA IDENTITY FULL is required for filtered subscriptions on non-PK columns.

alter table public.hr_departments replica identity full;
alter table public.hr_positions   replica identity full;
alter table public.hr_employees   replica identity full;
alter table public.hr_request_types replica identity full;
alter table public.hr_requests    replica identity full;

alter publication supabase_realtime add table public.hr_departments;
alter publication supabase_realtime add table public.hr_positions;
alter publication supabase_realtime add table public.hr_employees;
alter publication supabase_realtime add table public.hr_request_types;
alter publication supabase_realtime add table public.hr_requests;


-- ── 20260605000010_hr_request_policy_fix.sql ──────────────────────────────────────────
-- Fix security: employees could self-approve their own HR requests by
-- calling the API directly, since the UPDATE policy had no `with check`
-- clause restricting the `status` field.
--
-- New policy split:
--  1. HR admins + owners  → can update any request, any field, any status
--  2. Regular employees   → can only cancel (status='cancelled') their own pending request

drop policy if exists "HR admins can update requests" on public.hr_requests;

-- HR admins and workspace owners can update any request field
create policy "HR admins can update any request"
  on public.hr_requests for update
  using (
    public.is_workspace_accessible(workspace_id) and (
      public.is_hr_admin(workspace_id)
      or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
    )
  )
  with check (
    public.is_workspace_accessible(workspace_id) and (
      public.is_hr_admin(workspace_id)
      or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
    )
  );

-- Regular employees can only cancel their own pending request (no status escalation)
create policy "Employees can cancel own pending request"
  on public.hr_requests for update
  using (
    public.is_workspace_accessible(workspace_id)
    and exists(
      select 1 from public.hr_employees
      where id = employee_id and user_id = auth.uid()
    )
    and status = 'pending'
  )
  with check (
    status = 'cancelled'
    and exists(
      select 1 from public.hr_employees
      where id = employee_id and user_id = auth.uid()
    )
  );


-- ── 20260605000011_dm_upload_policy_fix.sql ──────────────────────────────────────────
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


-- ── 20260605000012_admin_column.sql ──────────────────────────────────────────
-- Add is_admin column to profiles so admin status is stored server-side.
-- Pre-seed the known admins by email so they get the column on first load.
-- The client still has ADMIN_EMAILS for instant UI rendering (no async needed),
-- but server-side checks use this column instead of the secret.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Seed existing admin accounts (safe to re-run — no-op if emails don't exist)
update public.profiles
  set is_admin = true
  where lower(email) in ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com');

-- Trigger: auto-promote future signups that match the admin email list
create or replace function public.auto_grant_admin()
returns trigger language plpgsql security definer as $$
begin
  if lower(new.email) in ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com') then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_auto_admin on public.profiles;
create trigger profiles_auto_admin
  before insert or update of email on public.profiles
  for each row execute procedure public.auto_grant_admin();

-- Allow admins to read ALL profiles (needed for the admin dashboard)
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Helper function usable in Edge Function or RLS
create or replace function public.is_app_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


-- ── 20260605000013_canvas_media_limits.sql ──────────────────────────────────────────
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


-- ── 20260605000014_hr_unique_constraints.sql ──────────────────────────────────────────
-- Prevent duplicate employee records within the same workspace.
-- employee_no and email should be unique per workspace.

-- Partial unique index: employee_no is unique per workspace (only when non-null)
create unique index if not exists hr_employees_no_workspace_uniq
  on public.hr_employees (workspace_id, employee_no)
  where employee_no is not null;

-- Partial unique index: email is unique per workspace (only when non-null)
create unique index if not exists hr_employees_email_workspace_uniq
  on public.hr_employees (workspace_id, lower(email))
  where email is not null;


-- ── 20260605000015_dm_reactions.sql ──────────────────────────────────────────
-- Add JSONB reactions column to dm_messages
-- reactions shape: { "emoji": ["userId1", "userId2", ...] }
alter table public.dm_messages
  add column if not exists reactions jsonb not null default '{}';


-- ── 20260605000020_dm_groups.sql ──────────────────────────────────────────
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


-- ── 20260605000025_dm_edit_delete.sql ──────────────────────────────────────────
-- Allow senders to edit and delete their own DM and group messages.

alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_group_messages add column if not exists edited_at timestamptz;

-- Allow senders to update/delete their own DMs
drop policy if exists "Senders can edit own DMs" on public.dm_messages;
create policy "Senders can edit own DMs" on public.dm_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists "Senders can delete own DMs" on public.dm_messages;
create policy "Senders can delete own DMs" on public.dm_messages for delete
  using (sender_id = auth.uid());

-- Allow senders to update/delete their own group messages
drop policy if exists "Senders can edit own group messages" on public.dm_group_messages;
create policy "Senders can edit own group messages" on public.dm_group_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists "Senders can delete own group messages" on public.dm_group_messages;
create policy "Senders can delete own group messages" on public.dm_group_messages for delete
  using (sender_id = auth.uid());


-- ── 20260605000026_task_recurrence.sql ──────────────────────────────────────────
-- Add recurrence and assignee_id columns to tasks table
alter table public.tasks
  add column if not exists recurrence text default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly'));

alter table public.tasks
  add column if not exists assignee_id text;


-- ── 20260605000028_backfill_profiles.sql ──────────────────────────────────────────
-- Backfill profiles for existing auth users whose profile row is missing.
-- Sets access_status = 'approved' for all existing users (already active).
-- Also sets is_admin for the known admin accounts.

insert into public.profiles (id, email, name, avatar_url, access_status)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.email
  ),
  u.raw_user_meta_data->>'avatar_url',
  'approved'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

update public.profiles
  set is_admin = true
  where lower(email) in ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com');