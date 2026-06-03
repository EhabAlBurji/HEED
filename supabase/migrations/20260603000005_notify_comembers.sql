-- Let workspace members notify each other (mentions / assignments) via a direct
-- insert — no privileged Edge Function needed. A notification row is allowed if
-- the recipient shares a workspace with the caller (or it's a self-notification).
drop policy if exists "Members can notify co-members" on public.notifications;
create policy "Members can notify co-members"
  on public.notifications for insert
  with check (
    recipient_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members them on them.workspace_id = me.workspace_id
      where me.user_id = auth.uid()
        and them.user_id = notifications.recipient_id
    )
  );
