-- 기존 버전에서 live_location 테이블을 실행한 적이 있는 경우의 정리용 SQL
-- Supabase SQL Editor에서 프로젝트 소유자가 검토 후 실행합니다.
-- 위치 공유 기능 및 저장된 좌표를 완전히 삭제합니다.
drop table if exists public.live_location;
delete from public.page_visibility where slug = 'location';
