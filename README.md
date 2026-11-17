# SIA SPACE

공개 주소: https://looloosia.github.io/sia-space/

개인 기록·연습 관리·활동 상태·영화·드라마 감상 기록을 제공하는 한글 중심 반응형 홈페이지입니다. GitHub Pages 정적 호스팅에서 실행합니다.

## 현재 브라우저에서 바로 사용할 수 있는 기능

- 피아노·순공 타이머 (시작, 일시정지, 종료 및 캘린더 기록)
- 연습 시간 요약·날짜별 달력·기록 목록을 **시:분:초** 단위로 표시
- 영화·드라마 감상 기록, 작품명 검색 후 포스터 수동 선택
- 영화 포스터: Apple iTunes Search API를 통한 검색, 드라마 포스터: TVmaze API 검색 (서버 연결 없이 시도 가능)
- 포스터 이미지를 직접 HTTPS 주소로 지정 가능
- TMDB API: 서버 Edge Function을 배포하고 관리자 로그인 시 우선 사용 (미배포 시 Apple/TVmaze로 대체)
- 첫 화면 대표 사진을 파일에서 업로드(브라우저 저장 전용) 또는 HTTPS 이미지 주소로 지정
- 아카이브: 사진·책·장소·프로젝트·음악·유튜브·개인 위키·타임라인 등록 및 수정
- 현재 활동 선택 및 상태 항목 추가 (관리자 인증 후에만 편집 UI 표시)
- 회원가입 신청(이메일/비밀번호), 이메일 인증 후 대기, 관리자 승인·등급 변경·승인 취소를 위한 화면 및 코드
- 등급 이름 변경(최대 10단계), 페이지·항목의 공개 등급 설정 (관리자 인증 후에만 편집 UI 표시)
- 소셜미디어 링크와 전화·문자·이메일 버튼
- JSON 로컬 데이터 백업·복원

**현재 상태:** Supabase 서울 프로젝트가 생성되어 있고 데이터베이스 RLS와 홈페이지 연결 정보가 반영됐습니다. 단, 관리자 계정 승격 및 Auth 사이트 URL 설정은 아직 완료되지 않았습니다. 새 로컬 기록은 관리자가 서버 게시 버튼을 눌러야 다른 방문자에게 보입니다.

## Supabase 연결 상태 및 남은 관리자 설정

**프로젝트:** https://supabase.com/dashboard/project/gjydiqwtwmzwtdnqiytu (ap-northeast-2, 서울). 기본 테이블 8개와 RLS 생성 완료, 공개용 publishable key로 GitHub Pages 연결 완료. 아래는 아직 필요한 **사용자 조작**입니다.

1. **완료:** 프로젝트 생성 및 `supabase/schema.sql` 스키마 실행. 인증 검사에서 익명 방문자는 1등급, 관리자 권한 없음으로 확인됐습니다.
2. **완료:** 보안 경고를 없애기 위해 RLS helper 함수를 `app_private` 스키마로 이동했고 Supabase 보안 조언 결과 경고 0개로 확인됐습니다.
3. **남은 조작:** [Authentication URL 설정](https://supabase.com/dashboard/project/gjydiqwtwmzwtdnqiytu/auth/url-configuration)에서 **Site URL**과 **Redirect URL**을 `https://looloosia.github.io/sia-space/`로 설정하세요. [Auth Providers](https://supabase.com/dashboard/project/gjydiqwtwmzwtdnqiytu/auth/providers)에서 이메일 인증 활성화 상태도 확인하세요.
4. Supabase **Authentication > Users**에서 본인 관리자 계정을 만든 뒤 **실제 UUID**를 확인합니다. SQL Editor에서 아래 문장을 **UUID만 바꿔** 실행하여 관리자 권한을 지정합니다.

   ```sql
   update public.member_profiles
   set is_admin = true, is_approved = true, member_level = 4
   where id = '여기에-본인-Auth-UUID';
   ```

   SQL 스키마 실행 전에 만들어진 기존 계정이라면 `member_profiles` 행이 없을 수 있으니 해당 계정을 스키마 실행 후 새로 생성하거나 행을 안전하게 삽입해야 합니다. **타인에게 관리자 권한을 부여하지 마세요.**

5. **완료:** `site-config.js`에 Supabase URL과 공개 가능한 publishable key 적용. GitHub에는 secret key, service_role key, SMTP 비밀번호, TMDB 비밀 토큰을 올리지 마세요.

6. GitHub Pages가 반영된 후 SIA SPACE **설정 > 회원 로그인**에서 관리자 계정으로 로그인합니다. 최초 게시 시에는 기존 로컬 데이터를 JSON으로 백업하고 "현재 기록 서버에 게시"를 사용합니다. 서버에 기존 자료가 있다면 먼저 "서버 기록 불러오기"로 모든 등급의 기록을 가져온 뒤 수정해서 게시합니다.

### TMDB 포스터 검색 활성화 (선택)

- [TMDB API](https://developer.themoviedb.org/docs/getting-started)에서 API Read Access Token을 발급받습니다.
- 컴퓨터에 Supabase CLI를 설치하고 프로젝트 연결 후, `supabase/functions/media-search/index.ts`를 Edge Function으로 배포합니다.
- 아래처럼 **Supabase 서버의 비밀 설정**에 토큰을 등록합니다.

  ```bash
  supabase secrets set TMDB_READ_ACCESS_TOKEN="발급받은-TMDB-읽기-토큰"
  supabase functions deploy media-search
  ```

- TMDB 검색은 관리자 JWT와 `is_admin`을 확인하므로 관리자 로그인 후 사용 가능합니다. 서버 연결이나 토큰이 없으면 기본 검색 API로 대체됩니다. TMDB 콘텐츠를 사용하면 출처를 표시해야 하며, 상업적 이용은 별도 라이선스가 필요할 수 있습니다.

## 데이터 공개 범위 및 보안

- 서버 연결 전: 등급 설정은 UI 미리보기일 뿐, **비공개 데이터 보호 기능이 아닙니다.**
- 서버 연결 후: `content_items`, `practice_sessions`, `site_presence`, `contact_methods` 데이터는 회원의 DB 등급과 해당 페이지의 공개 등급을 **모두** 확인하는 RLS 조회 정책을 적용합니다. 관리자로 등록된 계정만 서버에 변경사항을 게시할 수 있습니다.
- 대표 사진은 모두에게 공개되는 `sia-hero` Storage 버킷으로만 업로드합니다. 다른 민감한 사진/자료는 **공개 버킷에 업로드하지 마세요.**
- 실시간 위치 공유 기능은 안전을 위해 홈페이지와 DB 설계에서 제거했습니다. 이전 버전에서 위치 테이블을 이미 생성했다면 아래 정리 SQL을 별도로 실행해야 기존 좌표까지 삭제됩니다.
- 공유 상태 갱신은 현재 "관리자가 서버에 게시"를 눌러야 적용됩니다. 타이머의 백그라운드 시간은 기기 시각을 기반으로 누적됩니다.
- 타이머 자료 게시 시에는 밀리초를 **초 단위로 내림**하여 DB에 저장합니다. 동일한 날짜의 합계는 초를 기준으로 집계합니다.
- 로컬 설정 또는 기존 자료는 백엔드 연결 후 자동 업로드하지 않습니다. 서버 게시를 직접 선택해야 합니다.

## 로컬 실행

`index.html`을 브라우저에서 열거나 정적 서버에서 호스팅합니다. 서버 연결이 비어 있으면 로컬 모드로 동작합니다.

서버를 연결한 뒤에도 로그인, 공개 등급, 이미지 업로드, 엣지 함수 등이 실제 환경에서 정상 작동하는지 추가 테스트가 필요합니다. 배포 파일의 코드 작성만으로 라이브 검증이 완료되었다고 주장하지 않습니다.


## 편집 권한 및 로그인 화면

현재 `site-config.js`에 Supabase URL과 공개 키가 설정돼 있습니다. 관리자 로그인 전에는 편집 버튼이 숨겨지고, Supabase Auth로 로그인한 사용자의 `member_profiles.is_admin`이 `true`일 때만 수정 버튼과 설정 UI가 표시됩니다.

**서버에서 누가 관리자인지 아는 방법:** 사용자가 이메일과 비밀번호로 Supabase Auth에 로그인 → 서버가 인증한 사용자 UUID를 확인 → `member_profiles` 테이블에서 해당 UUID의 `is_admin` 확인. 이 UI 숨김과 별도로 콘텐츠 변경은 RLS 정책에 의해 DB 차원에서 관리자만 허용됩니다.

서버 연결 이전에 저장된 로컬 기록이 있는 브라우저라면 최초 연결 시 `sia-space-local-precloud-backup-v2`에 자동 보관하고 공개 화면에서 숨깁니다. 이후 관리자로 로그인하면 **이전 로컬 기록 복구** 버튼을 사용해 확인할 수 있습니다. 서버 게시를 누르기 전에는 방문자에게 반영되지 않습니다.

위치 기능은 일체 사용하지 않으며 GPS 권한도 요청하지 않습니다. 이전 DB에 위치 데이터가 이미 있었다면 `supabase/migrations/20261117_remove_location.sql`을 SQL Editor에서 실행해 `live_location` 테이블 자체를 삭제하세요. 신규 프로젝트에는 위치 공유 테이블을 생성하지 않았습니다.


## 회원가입·승인 흐름 (서버 연결 필요)

1. 방문자가 **회원가입 신청** 메뉴에서 표시 이름·이메일·비밀번호를 입력합니다.
2. Supabase Auth가 가입을 처리하고, 프로젝트에 이메일 인증을 활성화했으면 가입자가 메일의 인증 링크를 클릭합니다.
3. `member_profiles`의 트리거가 새 계정을 **1등급·미승인**으로 생성합니다.
4. 관리자로 로그인한 사람만 **가입 신청 · 회원 등급 관리**에서 가입자를 확인하고 2~10등급 중 하나로 승인할 수 있습니다.
5. 승인 후 다시 로그인하거나 새로고침하면 등급에 맞는 자료만 DB RLS 정책으로 조회할 수 있습니다.
6. 관리자 승인을 취소하면 다시 1등급으로 제한됩니다.

관리자가 최초 지정된 계정이 아니라면 일반 회원은 스스로 `is_admin` 또는 `is_approved`를 변경할 수 없습니다. 관리자의 승인 권한은 Supabase Auth 사용자 UUID와 서버의 `member_profiles.is_admin`에 의해 판별됩니다.

**현재 Supabase 연결 상태:** 프로젝트·DB·홈페이지 공개 키 연결 완료. Auth 리디렉션 주소와 최초 관리자 계정 지정이 아직 남았습니다. 외부 일반 회원에게 인증 이메일을 보내려면 [Supabase Auth의 사용자 지정 SMTP](https://supabase.com/dashboard/project/gjydiqwtwmzwtdnqiytu/auth/smtp)를 연결해야 합니다. Supabase 기본 발송 서비스는 프로젝트 팀에 속한 이메일 주소로 제한되므로, 외부 회원의 가입은 아직 운영 준비가 끝나지 않았습니다.

 
## 조회수 (2026-11-17 추가)

- 사이트 상단과 하단에 **누적 조회수** 및 **오늘 조회수** 표시. 홈페이지에서 `stats.js`가 Supabase Edge Function `site-visits`에 POST합니다.
- 같은 브라우저에서 하루에 1회(한국 시간 기준)만 집계됩니다. 따라서 숫자는 **실제 페이지 로드 횟수나 정확한 사람 수가 아닌, 브라우저별 일일 방문 건수**입니다.
- 브라우저의 임의 UUID를 서버에 전송하되 서버는 일자별 HMAC-SHA256 요약값만 `site_visit_days`에 기록하며 **원래 식별자·IP·이메일은 DB에 저장하지 않습니다.** 브라우저 데이터를 삭제하거나 자동화된 요청이 있으면 수치가 달라질 수 있습니다.
- 조회수는 기능 추가 이후부터 시작되며 과거 방문 기록을 소급하지 않습니다.
- DB 테이블: `supabase/site-visit-counter.sql` (실제 프로젝트에 적용됨). Edge Function 소스: `supabase/functions/site-visits/index.ts` (실제 프로젝트 배포됨).
- 이 집계 테이블은 RLS 활성화 및 `anon`·`authenticated` 권한 차단 상태이며, 서버에만 읽기/쓰기 권한이 있습니다. 공개 UI에는 합계만 전달합니다.

## 회원가입 이메일 인증 화면 (2026-11-17 개선)

- 회원가입 이름 필드에서 **본명 사용을 권장**합니다. 본명 사용을 강제하지는 않고, 관리자가 가입자를 알아보도록 돕기 위한 안내입니다.
- 가입 양식 상단에 **가입 신청 → 이메일 인증 → 관리자 승인** 단계가 표시됩니다.
- 가입 신청이 접수되면 인증 메일 확인 안내를 표시하고, 해당 브라우저에는 가입 이메일만 기억합니다. 메일함 열기(Gmail 주소에 한함), 메일 재발송, 인증 상태 확인, 로그인하기를 제공합니다.
- 이메일 인증 링크는 등록된 홈페이지 주소로 복귀하며, Supabase Auth의 `getUser()` 결과에 **실제 확인된 이메일 정보**가 있을 때만 “이메일 인증 완료”라고 표시합니다.
- 인증 완료 후 서버의 회원 프로필 `is_approved`를 확인해 **관리자 승인 대기** 또는 **회원 승인 완료**로 구분합니다. 쿼리 파라미터만으로 인증 완료를 판정하지 않습니다.
- 인증 메일을 다른 기기에서 클릭했으면 이 홈페이지로 로그인하여 상태를 확인할 수 있습니다.
- **제약:** Supabase 기본 메일 서비스는 프로젝트 팀 소속 이메일로 발송이 제한됩니다. 외부 방문자의 이메일 회원가입을 운영하려면 [Auth SMTP](https://supabase.com/dashboard/project/gjydiqwtwmzwtdnqiytu/auth/smtp)에 외부 SMTP를 구성해야 합니다.
