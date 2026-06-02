-- ────────────────────────────────────────────────────────────────────
-- Notify admins when a new user signs up and lands in the early-access
-- waitlist. Inserts an in-app notification for each admin; the client's
-- realtime subscription surfaces it in the bell instantly. Keep the admin
-- list in sync with src/lib/admin.ts and the ADMIN_EMAILS secret.
-- ────────────────────────────────────────────────────────────────────

create or replace function public.notify_admins_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_emails text[] := array['ehab@om.sa','ealburji@gmail.com','eelboragy@gmail.com'];
  admin_id uuid;
  new_email text := lower(coalesce(new.email, ''));
begin
  -- Only waitlisted (unapproved) new users, and never when an admin signs up.
  if new.access_status <> 'early_access' then return new; end if;
  if new_email = any (admin_emails) then return new; end if;

  for admin_id in
    select id from public.profiles where lower(email) = any (admin_emails)
  loop
    insert into public.notifications (id, recipient_id, type, title, body, read, created_at)
    values (
      gen_random_uuid()::text,
      admin_id,
      'info',
      'طلب وصول جديد · New access request',
      coalesce(new.name, new.email) || ' دخل قائمة الانتظار',
      false,
      now()
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_notify_admins_signup on public.profiles;
create trigger profiles_notify_admins_signup
  after insert on public.profiles
  for each row execute function public.notify_admins_new_signup();
