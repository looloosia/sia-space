-- SIA SPACE / Supabase 초기 스키마
-- SQL Editor에서 한 번 실행합니다. GitHub Pages 클라이언트에는 공개용 publishable key만 사용하세요.
-- 중요: 작성자 관리자 지정은 맨 아래 별도 설명대로 직접 실행해야 합니다.

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '회원',
  member_level integer not null default 2 check (member_level between 1 and 10),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.member_profiles enable row level security;

create or replace function public.sia_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.member_profiles p where p.id = auth.uid()), false);
$$;
create or replace function public.sia_member_level()
returns integer language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then 1
    else coalesce((select p.member_level from public.member_profiles p where p.id = auth.uid()), 1)
  end;
$$;
revoke all on function public.sia_is_admin() from public;
revoke all on function public.sia_member_level() from public;
grant execute on function public.sia_is_admin() to anon, authenticated;
grant execute on function public.sia_member_level() to anon, authenticated;

create or replace function public.sia_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.member_profiles (id, display_name, member_level, is_admin)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''),'회원'), 2, false)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists sia_auth_user_created on auth.users;
create trigger sia_auth_user_created
after insert on auth.users for each row execute procedure public.sia_on_auth_user_created();

create policy "member views own profile or admin views profiles" on public.member_profiles
  for select to authenticated using (id = auth.uid() or (select public.sia_is_admin()));
create policy "admin manages membership" on public.member_profiles
  for all to authenticated using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));

create table if not exists public.member_levels (
  level_number integer primary key check (level_number between 1 and 10),
  name text not null check (char_length(name) between 1 and 35)
);
alter table public.member_levels enable row level security;
create policy "anyone reads level names" on public.member_levels for select to anon,authenticated using (true);
create policy "admin edits levels" on public.member_levels for all to authenticated using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));
insert into public.member_levels(level_number,name) values
 (1,'일반 방문자'),(2,'일반 회원'),(3,'친구'),(4,'특별 회원')
on conflict do nothing;

create table if not exists public.page_visibility (
  slug text primary key check (char_length(slug) between 1 and 40),
  min_level integer not null default 1 check (min_level between 1 and 10)
);
alter table public.page_visibility enable row level security;
create policy "anyone can read page visibility labels" on public.page_visibility for select to anon,authenticated using (true);
create policy "admin controls page visibility" on public.page_visibility for all to authenticated using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));
insert into public.page_visibility (slug,min_level) values
 ('about',1),('now',1),('practice',1),('watch',1),('collections',1),('location',4),('community',1),('contact',2)
on conflict do nothing;

create table if not exists public.site_branding (
  id integer primary key default 1 check (id=1),
  hero_image_url text not null default '',
  social_instagram text not null default '',
  social_youtube text not null default '',
  social_blog text not null default '',
  status_options jsonb not null default '["쉬는 중","피아노 연습 중","공부 중","수업 중","이동 중","독서 중","외출 중","작업 중","수면 중"]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_branding enable row level security;
create policy "public reads site branding" on public.site_branding for select to anon,authenticated using (true);
create policy "admin edits site branding" on public.site_branding for all to authenticated using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));
insert into public.site_branding(id) values (1) on conflict do nothing;

create table if not exists public.site_presence (
  id integer primary key default 1 check (id=1),
  activity text not null default '쉬는 중',
  min_level integer not null default 1 check (min_level between 1 and 10),
  changed_at timestamptz not null default now()
);
alter table public.site_presence enable row level security;
create policy "allowed users read status" on public.site_presence for select to anon,authenticated
  using ((select public.sia_is_admin()) or
    (min_level <= (select public.sia_member_level()) and
     coalesce((select min_level from public.page_visibility where slug='now'),10) <= (select public.sia_member_level())));
create policy "admin writes status" on public.site_presence for all to authenticated
  using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));
insert into public.site_presence(id) values(1) on conflict do nothing;

create table if not exists public.content_items (
  id text primary key check (char_length(id) between 1 and 100),
  category text not null check (category in ('사진','책','장소','프로젝트','음악','유튜브','개인 위키','타임라인','영화','드라마')),
  title text not null check(char_length(title) between 1 and 200),
  body text not null default '',
  link_url text not null default '',
  poster_url text not null default '',
  poster_source text not null default '',
  poster_source_url text not null default '',
  watched_on date,
  min_level integer not null default 1 check(min_level between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists content_items_level_idx on public.content_items(min_level,category,created_at desc);
alter table public.content_items enable row level security;
create policy "allowed users read content" on public.content_items for select to anon,authenticated
  using ((select public.sia_is_admin()) or
    (min_level <= (select public.sia_member_level()) and
     coalesce((select min_level from public.page_visibility where slug=(case when category in ('영화','드라마') then 'watch' else 'collections' end)),10) <= (select public.sia_member_level())));
create policy "admin writes content" on public.content_items for all to authenticated
  using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));

create table if not exists public.practice_sessions (
  id text primary key check (char_length(id) between 1 and 100),
  practiced_on date not null,
  kind text not null check(kind in ('피아노 연습','순공')),
  duration_seconds integer not null check(duration_seconds between 0 and 86400),
  min_level integer not null default 1 check (min_level between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists practice_sessions_level_day_idx on public.practice_sessions(min_level,practiced_on);
alter table public.practice_sessions enable row level security;
create policy "allowed users read sessions" on public.practice_sessions for select to anon,authenticated
  using ((select public.sia_is_admin()) or
    (min_level <= (select public.sia_member_level()) and
     coalesce((select min_level from public.page_visibility where slug='practice'),10) <= (select public.sia_member_level())));
create policy "admin writes sessions" on public.practice_sessions for all to authenticated
  using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));

create table if not exists public.contact_methods (
  kind text primary key check (kind in ('phone','email')),
  destination text not null,
  min_level integer not null default 2 check(min_level between 1 and 10)
);
alter table public.contact_methods enable row level security;
create policy "allowed users read contacts" on public.contact_methods for select to anon,authenticated
  using ((select public.sia_is_admin()) or
    (min_level <= (select public.sia_member_level()) and
     coalesce((select min_level from public.page_visibility where slug='contact'),10) <= (select public.sia_member_level())));
create policy "admin writes contacts" on public.contact_methods for all to authenticated
  using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));

-- 위치 정보는 기본 OFF: 관리자와 허용 등급 외에는 SELECT 자체가 차단됩니다.
-- 아직 스마트폰 위치 업로드 기능과 주기 갱신은 구현하지 않았습니다.
create table if not exists public.live_location (
  id integer primary key default 1 check (id=1),
  latitude double precision check(latitude between -90 and 90),
  longitude double precision check(longitude between -180 and 180),
  enabled boolean not null default false,
  min_level integer not null default 4 check(min_level between 2 and 10),
  updated_at timestamptz
);
alter table public.live_location enable row level security;
create policy "enabled location only for allowed users" on public.live_location for select to anon,authenticated
  using ((select public.sia_is_admin()) or
  (enabled and min_level <= (select public.sia_member_level()) and
   coalesce((select min_level from public.page_visibility where slug='location'),10) <= (select public.sia_member_level())));
create policy "admin manages location" on public.live_location for all to authenticated
  using ((select public.sia_is_admin())) with check ((select public.sia_is_admin()));
insert into public.live_location(id,enabled,min_level) values (1,false,4) on conflict do nothing;

-- 대표 사진용 공개 버킷만 만듭니다. 비공개 사진은 별도 PRIVATE 버킷을 사용해야 합니다.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sia-hero','sia-hero',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "admin uploads hero files" on storage.objects for insert to authenticated
 with check (bucket_id='sia-hero' and (select public.sia_is_admin()));
create policy "admin updates hero files" on storage.objects for update to authenticated
 using (bucket_id='sia-hero' and (select public.sia_is_admin()))
 with check (bucket_id='sia-hero' and (select public.sia_is_admin()));
create policy "admin deletes hero files" on storage.objects for delete to authenticated
 using (bucket_id='sia-hero' and (select public.sia_is_admin()));

-- 관리자 설정(최초 1회): Supabase Auth > Users에서 본인 UUID 확인 후 아래 문장을 별도로 실행.
-- UPDATE public.member_profiles SET is_admin=true, member_level=4 WHERE id='본인-AUTH-UUID';
-- 이 구문을 임의 사용자 UUID로 실행하면 해당 사용자에게 관리자 권한이 생기므로 주의하세요.
