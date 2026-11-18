-- Applied to the existing SIA SPACE Supabase database.
-- Keeps existing place records unchanged; new records may store a selected address.
alter table public.content_items
  add column if not exists place_address text not null default ''
  check (char_length(place_address) <= 300);
