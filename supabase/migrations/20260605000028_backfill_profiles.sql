-- =========================================================================
-- Heed — Backfill profiles for existing auth users
-- The handle_new_user trigger creates a profile on each new signup, but
-- users who existed before the trigger was applied (or whose profile was
-- accidentally deleted) have no row in public.profiles.
--
-- This migration inserts a profile for every auth.users row that doesn't
-- have one. Existing users are set to 'approved' since they're already
-- active; the trigger default of 'early_access' still applies to new signups.
-- =========================================================================

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

-- Also set is_admin = true for the known admin accounts (idempotent).
update public.profiles
  set is_admin = true
  where lower(email) in ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com');
