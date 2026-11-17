// 공개 가능한 연결 정보만 설정합니다. 실제 서버 연결 전에는 빈 값으로 둡니다.
// Supabase Project URL, publishable key는 브라우저에 공개되어도 되는 값입니다.
// 절대로 service_role, secret API key, TMDB 토큰을 이 파일에 넣지 마세요.
window.SIA_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabasePublishableKey: ""
});

// 서버 인증 완료 전 로컬에 남아 있는 비공개 내용이 잠깐 노출되는 것을 방지합니다.
if (window.SIA_CONFIG.supabaseUrl && window.SIA_CONFIG.supabasePublishableKey) {
  document.documentElement.classList.add("cloud-authorizing");
}
