-- Add JSONB reactions column to dm_messages
-- reactions shape: { "emoji": ["userId1", "userId2", ...] }
alter table public.dm_messages
  add column if not exists reactions jsonb not null default '{}';
