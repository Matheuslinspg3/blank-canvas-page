const baseHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, origin",
};

const MAX_BODY_BYTES = 24_000;

const ALLOWED_EVENTS = new Set([
  "Lead",
  "CompleteRegistration",
  "TrialStarted",
  "Subscribe",
  "Purchase",
  "Contact",
  "ClickWhatsApp",
]);

function parseAllowlist() {
  return (Deno.env.get("META_CAPI_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function responseWithOrigin(status: number, body: Record<string, unknown>, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...baseHeaders,
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Content-Type": "application/json",
    },
  });
}

function validateOrigin(req: Request, allowlist: string[]) {
  const origin = req.headers.get("origin") || "";
  if (!origin || !allowlist.includes(origin)) return { ok: false, origin: "" };
  return { ok: true, origin };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normalizeEmail = (v: string) => v.trim().toLowerCase();
const normalizePhone = (v: string) => v.replace(/\D/g, "");

Deno.serve(async (req) => {
  const allowlist = parseAllowlist();

  if (Deno.env.get("META_CAPI_ENABLED") === "true" && allowlist.length === 0) {
    return responseWithOrigin(503, { error: "missing_capi_allowlist" });
  }

  const { ok, origin } = validateOrigin(req, allowlist);

  if (req.method === "OPTIONS") {
    if (!ok) return responseWithOrigin(403, { error: "origin_not_allowed" });
    return new Response(null, {
      status: 204,
      headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin },
    });
  }

  if (!ok) return responseWithOrigin(403, { error: "origin_not_allowed" });

  if (Deno.env.get("META_CAPI_ENABLED") !== "true") {
    return responseWithOrigin(200, { skipped: true, reason: "capi_disabled" }, origin);
  }

  const len = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) return responseWithOrigin(413, { error: "payload_too_large" }, origin);

  const pixel = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!pixel || !token) return responseWithOrigin(503, { error: "missing_meta_env" }, origin);

  try {
    const payload = await req.json();
    if (!payload || typeof payload !== "object") return responseWithOrigin(400, { error: "invalid_payload" }, origin);

    const event_name = String(payload.event_name || "");
    const event_id = String(payload.event_id || "");
    const action_source = String(payload.action_source || "website");

    if (!event_name || !event_id || !ALLOWED_EVENTS.has(event_name)) {
      return responseWithOrigin(400, { error: "invalid_event" }, origin);
    }

    const rawUserData = payload.user_data && typeof payload.user_data === "object" ? payload.user_data as Record<string, unknown> : {};
    const rawEmail = typeof rawUserData.email === "string" ? rawUserData.email : undefined;
    const rawPhone = typeof rawUserData.phone === "string" ? rawUserData.phone : undefined;

    const user_data: Record<string, unknown> = {};
    if (rawEmail) user_data.em = [await sha256(normalizeEmail(rawEmail))];
    if (rawPhone) {
      const normalized = normalizePhone(rawPhone);
      if (normalized.length >= 10) user_data.ph = [await sha256(normalized)];
    }

    const event_source_url = typeof payload.event_source_url === "string" ? payload.event_source_url : undefined;
    const custom_data = payload.custom_data && typeof payload.custom_data === "object" ? payload.custom_data : {};

    const fbPayload = {
      data: [{
        event_name,
        event_time: Number(payload.event_time) || Math.floor(Date.now() / 1000),
        event_id,
        action_source,
        event_source_url,
        user_data,
        custom_data,
      }],
      test_event_code: Deno.env.get("META_TEST_EVENT_CODE") || undefined,
    };

    const resp = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
    });

    const bodyText = await resp.text();
    return responseWithOrigin(resp.ok ? 200 : 502, {
      success: resp.ok,
      status: resp.status,
      meta_response: bodyText.slice(0, 800),
    }, origin);
  } catch (error) {
    console.error("meta-conversions-api error", { message: error instanceof Error ? error.message : "unknown" });
    return responseWithOrigin(500, { error: "internal_error" }, origin);
  }
});
