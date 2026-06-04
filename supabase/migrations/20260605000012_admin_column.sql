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
