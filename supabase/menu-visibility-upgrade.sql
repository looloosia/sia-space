-- Applied to the connected SIA SPACE project on 2026-11-17.
-- Backfill separate access levels using the previous shared archive rule if present.
insert into public.page_visibility (slug, min_level)
values
 ('home',coalesce((select min_level from public.page_visibility where slug='about'),1)),
 ('photos',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('books',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('places',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('projects',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('music',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('youtube',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('wiki',coalesce((select min_level from public.page_visibility where slug='collections'),1)),
 ('timeline',coalesce((select min_level from public.page_visibility where slug='collections'),1))
on conflict (slug) do nothing;

drop policy if exists "allowed users read content" on public.content_items;
create policy "allowed users read content" on public.content_items for select to anon, authenticated
using (
 (select app_private.sia_is_admin()) or
 (min_level <= (select app_private.sia_member_level()) and
  coalesce((select min_level from public.page_visibility where slug=(case category
    when '영화' then 'watch' when '드라마' then 'watch'
    when '사진' then 'photos' when '책' then 'books'
    when '장소' then 'places' when '프로젝트' then 'projects'
    when '음악' then 'music' when '유튜브' then 'youtube'
    when '개인 위키' then 'wiki' when '타임라인' then 'timeline'
    else 'unknown' end)),10) <= (select app_private.sia_member_level()))
);

drop policy if exists "public reads site branding" on public.site_branding;
create policy "public reads site branding" on public.site_branding for select to anon,authenticated
using ((select app_private.sia_is_admin()) or
 coalesce((select min_level from public.page_visibility where slug='home'),10)
 <= (select app_private.sia_member_level()));
