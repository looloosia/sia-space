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
- 현재 활동 선택 및 상태 항목 추가
- 등급 이름 변경(최대 10단계), 페이지·항목의 공개 등급 설정
- 소셜미디어 링크와 전화·문자·이메일 버튼
- JSON 로컬 데이터 백업·복원

**주의:** 별도 서버가 아직 연결되지 않은 기본 배포에서는 위 변경 내용이 해당 브라우저의 `localStorage`에만 저장됩니다. 사용자 인증/권한/서버 공유가 실제 활성화되었다는 뜻이 아닙니다. 다른 방문자나 다른 기기에는 로컬 변경이 나타나지 않습니다.

## 다음 단계: Supabase 백엔드 연결 (미설정)

저장소에 인증·데이터베이스·등급별 조회 정책(RLS)·관리자 게시 코드가 준비되어 있으나, **Supabase 프로젝트는 아직 만들어지거나 연결되지 않았습니다.** 아래 절차는 사용자가 자신의 프로젝트에서 직접 실행해야 합니다.

1. [Supabase](https://supabase.com/dashboard)에서 새 프로젝트를 만듭니다. Supabase 계정과 프로젝트를 사용자 본인이 소유해야 합니다.
2. 프로젝트의 **SQL Editor**에서 `supabase/schema.sql` 내용을 최초 1회 실행합니다. 이 스크립트는 RLS 정책과 공개용 대표사진 버킷을 생성합니다. **이미 운영 중인 DB에서는 덮어쓰기 전에 별도로 검토하세요.**
3. **Authentication**에서 이메일 로그인을 활성화합니다. 초대/비공개 운영을 원하면 일반 사용자가 임의로 가입하지 못하도록 가입 허용 설정을 제한합니다.
4. Supabase **Authentication > Users**에서 본인 관리자 계정을 만든 뒤 **실제 UUID**를 확인합니다. SQL Editor에서 아래 문장을 **UUID만 바꿔** 실행하여 관리자 권한을 지정합니다.

   ```sql
   update public.member_profiles
   set is_admin = true, member_level = 4
   where id = '여기에-본인-Auth-UUID';
   ```

   SQL 스키마 실행 전에 만들어진 기존 계정이라면 `member_profiles` 행이 없을 수 있으니 해당 계정을 스키마 실행 후 새로 생성하거나 행을 안전하게 삽입해야 합니다. **타인에게 관리자 권한을 부여하지 마세요.**

5. **Project Settings**에서 Project URL과 **publishable key**만 확인하고 `site-config.js`를 아래처럼 변경합니다.

   ```js
   window.SIA_CONFIG = Object.freeze({
     supabaseUrl: "https://내-프로젝트.supabase.co",
     supabasePublishableKey: "sb_publishable_..."
   });
   ```

   publishable key는 공개 클라이언트용이며 보안은 DB RLS에서 담당합니다. **secret key, service_role key, TMDB 토큰, 계정 비밀번호는 절대 GitHub 파일에 저장하면 안 됩니다.**

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
- 실시간 위치 데이터는 별도 테이블을 기본 **공유 OFF**로 준비했습니다. **스마트폰 GPS 수집, 주기적 업로드, 배경 위치 추적은 아직 구현하지 않았습니다.**
- 공유 상태 갱신은 현재 "관리자가 서버에 게시"를 눌러야 적용됩니다. 타이머의 백그라운드 시간은 기기 시각을 기반으로 누적됩니다.
- 타이머 자료 게시 시에는 밀리초를 **초 단위로 내림**하여 DB에 저장합니다. 동일한 날짜의 합계는 초를 기준으로 집계합니다.
- 로컬 설정 또는 기존 자료는 백엔드 연결 후 자동 업로드하지 않습니다. 서버 게시를 직접 선택해야 합니다.

## 로컬 실행

`index.html`을 브라우저에서 열거나 정적 서버에서 호스팅합니다. 서버 연결이 비어 있으면 로컬 모드로 동작합니다.

서버를 연결한 뒤에도 로그인, 공개 등급, 이미지 업로드, 엣지 함수, 위치 권한 등이 실제 환경에서 정상 작동하는지 추가 테스트가 필요합니다. 배포 파일의 코드 작성만으로 라이브 검증이 완료되었다고 주장하지 않습니다.
