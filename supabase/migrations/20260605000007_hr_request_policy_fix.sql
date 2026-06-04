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
