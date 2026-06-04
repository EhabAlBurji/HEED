-- =========================================================================
-- Heed — Chat conversation sync
-- Stores Heed Chat conversations per user so they're available on all
-- devices. One row per user; updated via upsert on every chat change.
-- =========================================================================

create table if not exists public.user_chat_data (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  conversations jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.user_chat_data enable row level security;

create policy "Users manage their own chat data"
  on public.user_chat_data for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
