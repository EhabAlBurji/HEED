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
