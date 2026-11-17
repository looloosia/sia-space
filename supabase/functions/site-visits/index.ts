import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ALLOWED_ORIGIN = "https://looloosia.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function koreanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = (kind: string) => parts.find(p => p.type === kind)?.value ?? "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

function privilegedKey() {
  const dictionary = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary);
      if (typeof keys.default === "string" && keys.default) return keys.default;
    } catch { /* fallback to legacy secret */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function makeDailyKey(secret: string, date: string, visitorId: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, encoder.encode(date + ":" + visitorId)
  ));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const origin = request.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return reply(403, { error: "origin_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const key = privilegedKey();
  if (!url || !key) return reply(503, { error: "not_configured" });

  try {
    const payload = await request.json();
    const visitorId = String(payload?.visitorId ?? "");
    // Random browser-scoped ID; never store the plaintext ID.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
      return reply(400, { error: "invalid_visitor_id" });
    }
    const day = koreanDate();
    const digest = await makeDailyKey(key, day, visitorId);
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const inserted = await admin.from("site_visit_days")
      .upsert({ visited_on: day, visitor_key: digest },
        { onConflict: "visited_on,visitor_key", ignoreDuplicates: true });
    if (inserted.error) throw inserted.error;

    const [all, today] = await Promise.all([
      admin.from("site_visit_days").select("visitor_key", { head: true, count: "exact" }),
      admin.from("site_visit_days").select("visitor_key", { head: true, count: "exact" }).eq("visited_on", day),
    ]);
    if (all.error) throw all.error;
    if (today.error) throw today.error;
    return reply(200, {
      total: all.count ?? 0,
      today: today.count ?? 0,
      counting: "one_per_browser_per_day",
      timezone: "Asia/Seoul",
    });
  } catch (error) {
    console.error("Site visit counting failed", String(error));
    return reply(500, { error: "counter_unavailable" });
  }
});
