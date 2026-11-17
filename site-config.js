// 공개 가능한 연결 정보만 설정합니다. 실제 서버 연결 전에는 빈 값으로 둡니다.
// Supabase Project URL, publishable key는 브라우저에 공개되어도 되는 값입니다.
// 절대로 service_role, secret API key, TMDB 토큰을 이 파일에 넣지 마세요.
window.SIA_CONFIG = Object.freeze({
  supabaseUrl: "https://gjydiqwtwmzwtdnqiytu.supabase.co",
  supabasePublishableKey: "sb_publishable_LW0Th6ufATl_ppr8t9xTbw_ISZl5joy"
});

// 서버 인증 완료 전 로컬에 남아 있는 비공개 내용이 잠깐 노출되는 것을 방지합니다.
if (window.SIA_CONFIG.supabaseUrl && window.SIA_CONFIG.supabasePublishableKey) {
  document.documentElement.classList.add("cloud-authorizing");
  // Earlier versions stored a phone field in local drafts; scrub it from browser copies.
  for (const storageKey of ["sia-space-local-v2","sia-space-local-precloud-backup-v2"]) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && data.contact && typeof data.contact === "object" && "phone" in data.contact) {
        delete data.contact.phone;
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn("이전 연락처 데이터 정리에 실패했습니다.", error);
    }
  }
  // 최초 서버 연결 시 기존 로컬 기록을 안전하게 보관해, 일반 방문자 화면에 나타나지 않도록 합니다.
  try {
    const draft = localStorage.getItem("sia-space-local-v2");
    const archiveKey = "sia-space-local-precloud-backup-v2";
    if (draft && !localStorage.getItem(archiveKey)) {
      localStorage.setItem(archiveKey, draft);
      localStorage.removeItem("sia-space-local-v2");
    }
  } catch (error) {
    console.warn("기존 로컬 기록의 자동 보관에 실패했습니다.", error);
  }
}
