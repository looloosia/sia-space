-- Applied to the SIA SPACE Supabase project on 2026-11-17.
-- Remove stored telephone contact; email and social accounts remain untouched.
delete from public.contact_methods where kind='phone';
alter table public.contact_methods drop constraint if exists contact_methods_kind_check;
alter table public.contact_methods add constraint contact_methods_kind_check
check (kind in ('email','instagram','youtube','blog'));