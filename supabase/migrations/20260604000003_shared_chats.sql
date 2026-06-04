-- =========================================================================
-- Heed — Shared AI conversations
-- Public read access so anyone with the link can view the conversation.
-- Owner can create / update / delete their shares.
-- =========================================================================

create table if not exists public.shared_chats (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Shared chat',
  messages     jsonb not null default '[]'::jsonb,
  assistant_name text not null default 'Heed Assistant',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.shared_chats enable row level security;

-- Anyone (including anonymous) can read a shared chat by its ID.
create policy "Public read shared chats"
  on public.shared_chats for select
  using (true);

-- Authenticated owner manages their own shares.
create policy "Owner manages shares"
  on public.shared_chats for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
