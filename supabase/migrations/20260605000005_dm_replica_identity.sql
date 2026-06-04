-- Supabase Realtime filtered subscriptions (filter: receiver_id=eq.X) require
-- REPLICA IDENTITY FULL on the table so non-PK columns are available in the WAL.
alter table public.dm_messages replica identity full;
