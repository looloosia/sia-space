-- Applied to production Supabase on 2026-11-25.
-- Preserve formerly category-restricted posts before replacing read policy.
insert into public.page_visibility (slug,min_level)
select 'records', coalesce(min(min_level),1)
from public.page_visibility
where slug in ('watch','photos','books','places','projects','music','youtube','wiki','timeline')
on conflict(slug) do nothing;

update public.content_items as c
set min_level=greatest(c.min_level,coalesce((
 select p.min_level from public.page_visibility p where p.slug=case c.category
   when '영화' then 'watch' when '드라마' then 'watch'
   when '사진' then 'photos' when '책' then 'books'
   when '장소' then 'places' when '프로젝트' then 'projects'
   when '음악' then 'music' when '유튜브' then 'youtube'
   when '개인 위키' then 'wiki' when '타임라인' then 'timeline'
   else 'collections' end
),10))
where c.min_level<coalesce((
 select p.min_level from public.page_visibility p where p.slug=case c.category
   when '영화' then 'watch' when '드라마' then 'watch'
   when '사진' then 'photos' when '책' then 'books'
   when '장소' then 'places' when '프로젝트' then 'projects'
   when '음악' then 'music' when '유튜브' then 'youtube'
   when '개인 위키' then 'wiki' when '타임라인' then 'timeline'
   else 'collections' end
),10);

drop policy if exists "allowed users read content" on public.content_items;
create policy "allowed users read content"
on public.content_items for select to anon,authenticated
using (
  (select app_private.sia_is_admin()) or (
    min_level <= (select app_private.sia_member_level())
    and coalesce((select min_level from public.page_visibility where slug='records'),10)
    <= (select app_private.sia_member_level())
  )
);
