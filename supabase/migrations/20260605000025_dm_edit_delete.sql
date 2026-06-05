-- Allow senders to edit and delete their own DM and group messages.

alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_group_messages add column if not exists edited_at timestamptz;

-- Allow senders to update/delete their own DMs
create policy "Senders can edit own DMs" on public.dm_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy "Senders can delete own DMs" on public.dm_messages for delete
  using (sender_id = auth.uid());

-- Allow senders to update/delete their own group messages
create policy "Senders can edit own group messages" on public.dm_group_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy "Senders can delete own group messages" on public.dm_group_messages for delete
  using (sender_id = auth.uid());
