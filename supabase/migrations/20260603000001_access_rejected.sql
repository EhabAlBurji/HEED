-- Allow an admin to reject / revoke a user's access (even after approval).
-- Extend the access_status CHECK constraint to include 'rejected'.
alter table public.profiles
  drop constraint if exists profiles_access_status_check;

alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('early_access', 'approved', 'rejected'));
