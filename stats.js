(() => {
"use strict";
const header = document.getElementById("siteViewCountTop");
const footer = document.getElementById("siteViewCountFooter");
const config = window.SIA_CONFIG || {};

function render(message, detail = "") {
  if (header) {
    header.textContent = message;
    header.title = detail || "동일 브라우저에서는 하루 한 번 집계합니다.";
  }
  if (footer) {
    footer.textContent = message;
    footer.title = detail || "같은 브라우저에서 하루 한 번 집계되는 참고용 조회수입니다.";
  }
}

function visitorId() {
  const storageKey = "sia-space-visitor-id-v1";
  try {
    let value = localStorage.getItem(storageKey);
    if (value && /^[\da-f-]{36}$/i.test(value)) return value;
    value = crypto.randomUUID();
    localStorage.setItem(storageKey, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

async function countVisit() {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    render("조회수 준비 중");
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/functions/v1/site-visits", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": config.supabasePublishableKey
      },
      body: JSON.stringify({ visitorId: visitorId() }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const result = await response.json();
    if (!Number.isSafeInteger(result.total) || !Number.isSafeInteger(result.today)) {
      throw new Error("잘못된 조회수 응답");
    }
    const total = result.total.toLocaleString("ko-KR");
    const today = result.today.toLocaleString("ko-KR");
    render("누적 조회수 " + total, "오늘 " + today + "회 · 같은 브라우저 하루 한 번 집계");
    if (footer) footer.textContent = "누적 조회수 " + total + " · 오늘 " + today;
  } catch (error) {
    render("조회수 일시 중단", "조회수 서버에 연결할 수 없습니다.");
    console.warn("SIA SPACE 조회수 오류:", error);
  } finally {
    clearTimeout(timer);
  }
}
countVisit();
})();
