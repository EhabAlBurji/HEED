-- Request-to-join + admin approval for shared workspaces.
-- A user submits a request (by workspace code/id); the workspace owner (admin)
-- sees it and approves (→ becomes a member) or rejects.
create table if not exists public.workspace_join_requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text,
  email        text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.workspace_join_requests enable row level security;

-- A user manages their own request.
create policy "jr own insert" on public.workspace_join_requests
  for insert with check (user_id = auth.uid());
create policy "jr own select" on public.workspace_join_requests
  for select using (user_id = auth.uid());
create policy "jr own delete" on public.workspace_join_requests
  for delete using (user_id = auth.uid());

-- A workspace owner (admin) sees + acts on requests for their workspace.
create policy "jr admin select" on public.workspace_join_requests
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_join_requests.workspace_id
        and m.user_id = auth.uid() and m.role = 'owner'
    )
  );
create policy "jr admin update" on public.workspace_join_requests
  for update using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_join_requests.workspace_id
        and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

alter publication supabase_realtime add table public.workspace_join_requests;
