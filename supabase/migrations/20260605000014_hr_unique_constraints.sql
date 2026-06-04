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
