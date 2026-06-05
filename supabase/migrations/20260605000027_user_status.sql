-- Add user custom status columns to profiles
alter table public.profiles add column if not exists status_emoji text default '';
alter table public.profiles add column if not exists status_text  text default '';
