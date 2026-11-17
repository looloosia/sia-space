-- SIA SPACE / 하루 한 번 집계되는 익명 웹사이트 조회수
-- Supabase 프로젝트에 이미 적용된 스키마. 운영 DB에 중복 적용할 필요 없음.
-- 사용자의 IP 주소, 사용자 이름, 이메일은 수집·저장하지 않습니다.
create table if not exists public.site_visit_days (
  visited_on date not null,
  visitor_key text not null check (visitor_key ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default now(),
  primary key (visited_on, visitor_key)
);
alter table public.site_visit_days enable row level security;
revoke all on public.site_visit_days from anon, authenticated;
grant select, insert on public.site_visit_days to service_role;
comment on table public.site_visit_days is
  'Daily deduplicated visits. HMAC-SHA256 hash per browser per day, no plaintext ID or IP.';
-- 기록 추가와 공개 집계 반환은 공개 Supabase Edge Function site-visits에서 담당합니다.
-- 서비스 키는 Edge Function 서버 환경변수로만 사용합니다.
