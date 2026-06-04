-- Enable Supabase Realtime for dm_messages so receivers get live notifications.
alter publication supabase_realtime add table public.dm_messages;
