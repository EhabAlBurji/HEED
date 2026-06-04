-- Enable Supabase Realtime for HR tables so changes propagate instantly.
-- REPLICA IDENTITY FULL is required for filtered subscriptions on non-PK columns.

alter table public.hr_departments replica identity full;
alter table public.hr_positions   replica identity full;
alter table public.hr_employees   replica identity full;
alter table public.hr_request_types replica identity full;
alter table public.hr_requests    replica identity full;

alter publication supabase_realtime add table public.hr_departments;
alter publication supabase_realtime add table public.hr_positions;
alter publication supabase_realtime add table public.hr_employees;
alter publication supabase_realtime add table public.hr_request_types;
alter publication supabase_realtime add table public.hr_requests;
