-- Allow admins (by email) to update any profile, so the Admin dashboard can
-- approve / reject a user's access via a direct update (no Edge Function).
-- Keep the email list in sync with ADMIN_EMAILS in src/lib/admin.ts.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using ( lower(coalesce(auth.jwt() ->> 'email', '')) in
    ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com') )
  with check ( lower(coalesce(auth.jwt() ->> 'email', '')) in
    ('ehab@om.sa', 'ealburji@gmail.com', 'eelboragy@gmail.com') );
