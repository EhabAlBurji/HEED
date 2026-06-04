-- =========================================================================
-- Heed — Direct Messages between users
-- One row per message. Each user sees only messages they sent or received.
-- =========================================================================

create table if not exists public.dm_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  content      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists dm_messages_sender_receiver_idx
  on public.dm_messages(sender_id, receiver_id, created_at desc);

create index if not exists dm_messages_receiver_sender_idx
  on public.dm_messages(receiver_id, sender_id, created_at desc);

alter table public.dm_messages enable row level security;

create policy "Users see their own DMs"
  on public.dm_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users send DMs"
  on public.dm_messages for insert
  with check (sender_id = auth.uid());

create policy "Recipients mark messages read"
  on public.dm_messages for update
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());
