-- Applied to SIA SPACE on 2026-11-25: authenticated photo library uploads.
-- RLS on content_items and storage.objects jointly controls private image access.
alter table public.content_items
 add column if not exists image_path text not null default ''
 check (char_length(image_path) <= 300);
create index if not exists sia_content_image_path_idx
 on public.content_items(image_path) where image_path<>'';
-- 개인 기록에 첨부된 이미지는 비공개 버킷에서만 제공됩니다.
-- 파일 URL은 각 게시물 조회 RLS로 접근 가능한 사용자에게만 단기 서명해 줍니다.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sia-record-media','sia-record-media',false,6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=6291456,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "sia admin uploads record images" on storage.objects for insert to authenticated
with check (bucket_id='sia-record-media' and (select app_private.sia_is_admin()));
create policy "sia record images visible at published record level" on storage.objects for select to anon,authenticated
using (
 bucket_id='sia-record-media'
 and ((select app_private.sia_is_admin()) or exists(
  select 1 from public.content_items c where c.image_path=storage.objects.name
 ))
);
create policy "sia admin removes record images" on storage.objects for delete to authenticated
using (bucket_id='sia-record-media' and (select app_private.sia_is_admin()));

