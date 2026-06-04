-- =========================================================================
-- Allow authenticated users to search approved profiles for DM discovery.
-- Without this, users can only DM workspace members they already share.
-- =========================================================================

-- Any signed-in user can read approved profiles (name + email only).
-- This is safe: we only expose non-sensitive fields via the app layer.
drop policy if exists "Authenticated users can search approved profiles" on public.profiles;
create policy "Authenticated users can search approved profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and access_status = 'approved'
  );
