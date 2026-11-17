-- SIA SPACE: guestbook, personal Q&A, and private coffee-chat requests
-- Member-to-member communication intentionally not supported.

create table if not exists public.community_permissions (
  feature text primary key check (feature in ('guestbook', 'questions', 'coffee')),
  min_write_level integer not null check (min_write_level between 2 and 10)
);
alter table public.community_permissions enable row level security;
insert into public.community_permissions (feature,min_write_level)
values ('guestbook',2),('questions',2),('coffee',3)
on conflict (feature) do nothing;

create policy "everyone reads community writing requirements"
on public.community_permissions for select to anon,authenticated using (true);
create policy "admin adjusts community writing requirements"
on public.community_permissions for update to authenticated
using ((select app_private.sia_is_admin()))
with check ((select app_private.sia_is_admin()));

create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 700),
  admin_reply text check (admin_reply is null or char_length(btrim(admin_reply)) between 1 and 1500),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists guestbook_messages_recent_idx on public.guestbook_messages(created_at desc);
create index if not exists guestbook_messages_author_idx on public.guestbook_messages(author_id,created_at desc);
alter table public.guestbook_messages enable row level security;

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  is_public boolean not null default true,
  admin_reply text check (admin_reply is null or char_length(btrim(admin_reply)) between 1 and 3000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_questions_recent_idx on public.community_questions(created_at desc);
create index if not exists community_questions_author_idx on public.community_questions(author_id,created_at desc);
alter table public.community_questions enable row level security;

create table if not exists public.coffee_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preferred_schedule text not null check (char_length(btrim(preferred_schedule)) between 2 and 200),
  message text not null check (char_length(btrim(message)) between 2 and 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  admin_reply text check (admin_reply is null or char_length(btrim(admin_reply)) between 1 and 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coffee_requests_author_idx on public.coffee_requests(author_id,created_at desc);
create index if not exists coffee_requests_status_idx on public.coffee_requests(status,created_at desc);
alter table public.coffee_requests enable row level security;

-- Service credentials and admin control table-level access, RLS additionally restricts every row.
grant select on public.community_permissions to anon,authenticated;
grant update on public.community_permissions to authenticated;
grant select on public.guestbook_messages,public.community_questions to anon,authenticated;
grant select,insert,delete,update on public.guestbook_messages,public.community_questions to authenticated;
grant select,insert,delete,update on public.coffee_requests to authenticated;

-- Read: guestbook public inside allowed community menu, and author's own posts always readable.
create policy "guestbook read allowed or owned"
on public.guestbook_messages for select to anon,authenticated
using (
 (select app_private.sia_is_admin())
 or author_id = (select auth.uid())
 or coalesce((select min_level from public.page_visibility where slug='community'),10) <=
    (select app_private.sia_member_level())
);
create policy "questions public or owned or admin"
on public.community_questions for select to anon,authenticated
using (
 (select app_private.sia_is_admin())
 or author_id = (select auth.uid())
 or (
   is_public
   and coalesce((select min_level from public.page_visibility where slug='community'),10) <=
       (select app_private.sia_member_level())
 )
);
create policy "private coffee requests only owner and admin"
on public.coffee_requests for select to authenticated
using (author_id = (select auth.uid()) or (select app_private.sia_is_admin()));

-- Write: verified, approved members whose effective level meets the relevant threshold.
-- An unapproved signup cannot bypass the requirement by supplying its own member_level.
create policy "approved members sign guestbook"
on public.guestbook_messages for insert to authenticated
with check (
 author_id = (select auth.uid())
 and admin_reply is null and replied_at is null
 and exists(select 1 from public.member_profiles p where p.id=auth.uid() and (p.is_approved or p.is_admin))
 and (select app_private.sia_member_level()) >=
   coalesce((select min_write_level from public.community_permissions where feature='guestbook'),10)
 and (select app_private.sia_member_level()) >=
   coalesce((select min_level from public.page_visibility where slug='community'),10)
);
create policy "approved members ask questions"
on public.community_questions for insert to authenticated
with check (
 author_id = (select auth.uid())
 and admin_reply is null and replied_at is null
 and exists(select 1 from public.member_profiles p where p.id=auth.uid() and (p.is_approved or p.is_admin))
 and (select app_private.sia_member_level()) >=
   coalesce((select min_write_level from public.community_permissions where feature='questions'),10)
 and (select app_private.sia_member_level()) >=
   coalesce((select min_level from public.page_visibility where slug='community'),10)
);
create policy "approved friends request coffee"
on public.coffee_requests for insert to authenticated
with check (
 author_id = (select auth.uid())
 and status='pending' and admin_reply is null and replied_at is null
 and exists(select 1 from public.member_profiles p where p.id=auth.uid() and (p.is_approved or p.is_admin))
 and (select app_private.sia_member_level()) >=
   coalesce((select min_write_level from public.community_permissions where feature='coffee'),10)
 and (select app_private.sia_member_level()) >=
   coalesce((select min_level from public.page_visibility where slug='community'),10)
);

-- Only owner of the site can reply, change request status or moderate posts.
create policy "admin replies to guestbook"
on public.guestbook_messages for update to authenticated
using ((select app_private.sia_is_admin()))
with check ((select app_private.sia_is_admin()));
create policy "admin replies to questions"
on public.community_questions for update to authenticated
using ((select app_private.sia_is_admin()))
with check ((select app_private.sia_is_admin()));
create policy "admin manages coffee requests"
on public.coffee_requests for update to authenticated
using ((select app_private.sia_is_admin()))
with check ((select app_private.sia_is_admin()));

create policy "author or admin deletes guestbook"
on public.guestbook_messages for delete to authenticated
using (author_id = (select auth.uid()) or (select app_private.sia_is_admin()));
create policy "author or admin deletes questions"
on public.community_questions for delete to authenticated
using (author_id = (select auth.uid()) or (select app_private.sia_is_admin()));
create policy "author or admin deletes coffee requests"
on public.coffee_requests for delete to authenticated
using (author_id = (select auth.uid()) or (select app_private.sia_is_admin()));

-- Defend against rapid automated posting by a legitimate, approved account.
create or replace function app_private.sia_limit_community_post()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare n integer;
begin
  new.created_at := now();
  if new.author_id is distinct from auth.uid() then
    raise exception 'Cannot submit for another account';
  end if;
  if tg_table_name = 'guestbook_messages' then
    select count(*) into n from public.guestbook_messages
    where author_id=auth.uid() and created_at > now()-interval '1 hour';
    if n >= 5 then raise exception 'Too many guestbook entries. Try again later'; end if;
  elsif tg_table_name = 'community_questions' then
    select count(*) into n from public.community_questions
    where author_id=auth.uid() and created_at > now()-interval '1 hour';
    if n >= 5 then raise exception 'Too many questions. Try again later'; end if;
  elsif tg_table_name = 'coffee_requests' then
    select count(*) into n from public.coffee_requests
    where author_id=auth.uid() and created_at > now()-interval '24 hours';
    if n >= 2 then raise exception 'Too many coffee requests. Try again later'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.sia_limit_community_post() from public;
grant execute on function app_private.sia_limit_community_post() to authenticated;

create trigger sia_guestbook_limit before insert on public.guestbook_messages
for each row execute function app_private.sia_limit_community_post();
create trigger sia_questions_limit before insert on public.community_questions
for each row execute function app_private.sia_limit_community_post();
create trigger sia_coffee_limit before insert on public.coffee_requests
for each row execute function app_private.sia_limit_community_post();
