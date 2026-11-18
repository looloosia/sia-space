import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ORIGIN = "https://looloosia.github.io";
const headers = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Vary": "Origin",
};
const respond = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers });

function safeText(value: unknown, maxLength: number) {
  // NAVER search titles can include HTML highlight tags.
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim().slice(0, maxLength);
}
function publishableKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) {
    try {
      const obj = JSON.parse(keys);
      if (typeof obj.default === "string" && obj.default) return obj.default;
    } catch { /* invalid environment config */ }
  }
  // This key is publishable by design and already present in the public frontend.
  return "sb_publishable_LW0Th6ufATl_ppr8t9xTbw_ISZl5joy";
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond(405, { code: "method_not_allowed" });
  const origin = request.headers.get("origin");
  if (origin && origin !== ORIGIN) return respond(403, { code: "origin_not_allowed" });

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond(401, { code: "login_required" });
  const projectUrl = Deno.env.get("SUPABASE_URL");
  if (!projectUrl) return respond(503, { code: "server_not_configured" });

  try {
    // Authentication is checked here because Supabase publishable keys do not
    // use the legacy JWT check performed by the Edge gateway.
    const scopedClient = createClient(projectUrl, publishableKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = await scopedClient.auth.getUser(token);
    if (auth.error || !auth.data.user) return respond(401, { code: "login_required" });
    const { data: profile, error: profileError } = await scopedClient.from("member_profiles")
      .select("is_admin").eq("id", auth.data.user.id).maybeSingle();
    if (profileError || !profile?.is_admin) return respond(403, { code: "admin_required" });

    const body = await request.json().catch(() => null);
    const query = safeText(body?.query, 100);
    if (query.length < 2) return respond(400, { code: "invalid_query" });

    const clientId = Deno.env.get("NAVER_API_HUB_CLIENT_ID");
    const clientSecret = Deno.env.get("NAVER_API_HUB_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return respond(503, {
        code: "naver_not_configured",
        message: "NAVER API HUB 인증 정보가 아직 등록되지 않았습니다.",
      });
    }

    const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/local");
    url.searchParams.set("query", query);
    url.searchParams.set("display", "5");
    url.searchParams.set("start", "1");
    url.searchParams.set("sort", "random");
    url.searchParams.set("format", "json");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let external: Response;
    try {
      external = await fetch(url, {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": clientId,
          "X-NCP-APIGW-API-KEY": clientSecret,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!external.ok) {
      console.error("NAVER API HUB search status:", external.status);
      return respond(external.status === 429 ? 429 : 502, { code: "naver_api_failed" });
    }
    const result = await external.json();
    const items = Array.isArray(result.items) ? result.items : [];
    return respond(200, {
      items: items.slice(0, 5).map((x: Record<string, unknown>) => {
        const title = safeText(x.title, 120);
        const address = safeText(x.roadAddress || x.address, 300);
        const category = safeText(x.category, 120);
        const mapSearch = [title, address].filter(Boolean).join(" ");
        return {
          title, address, category,
          mapUrl: "https://map.naver.com/p/search/" + encodeURIComponent(mapSearch),
        };
      }).filter((x: { title: string }) => Boolean(x.title)),
      source: "NAVER API HUB",
    });
  } catch (error) {
    console.error("NAVER places lookup failed:", String(error));
    return respond(502, { code: "search_unavailable" });
  }
});
