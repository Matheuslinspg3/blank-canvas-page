import { getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFRESH_WEBHOOK_URL =
  "https://n8n.costazul.shop/webhook/autouazapiagenteiavalentQR-CODE";

const tryParseJson = (value: string): any | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeWebhookText = (value: string): string =>
  value
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "")
    .replace(/\\r/g, "")
    .trim();

const parseWebhookResponse = (rawText: string): any | null => {
  let candidate: any = rawText;

  for (let i = 0; i < 4; i++) {
    if (typeof candidate !== "string") break;

    const trimmed = candidate.trim();
    if (!trimmed) return null;

    const parsed = tryParseJson(trimmed);
    if (parsed !== null) {
      candidate = parsed;
      continue;
    }

    const unquoted = trimmed.replace(/^\s*"|"\s*$/g, "").trim();
    if (unquoted && unquoted !== trimmed) {
      candidate = unquoted;
      continue;
    }

    const firstCurly = trimmed.indexOf("{");
    const lastCurly = trimmed.lastIndexOf("}");
    if (firstCurly >= 0 && lastCurly > firstCurly) {
      candidate = trimmed.slice(firstCurly, lastCurly + 1);
      continue;
    }

    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      candidate = trimmed.slice(firstBracket, lastBracket + 1);
      continue;
    }

    break;
  }

  if (typeof candidate === "string") {
    return tryParseJson(candidate.trim());
  }

  return candidate;
};

const extractWebhookFields = (rawText: string, webhookData: any) => {
  const normalizedRaw = normalizeWebhookText(rawText);
  const responseObj = Array.isArray(webhookData) ? webhookData[0] : webhookData;
  const responseData = responseObj?.data ?? responseObj;

  let qrBase64 = responseData?.base64 ??
    responseData?.qrCode ??
    responseData?.qr_code ??
    responseData?.["QR-CODE(BASE64)"] ??
    responseObj?.["QR-CODE(BASE64)"] ??
    null;

  let pairingCode = responseData?.pairingCode ?? responseData?.pairing_code ?? null;
  let code = responseData?.code ?? null;
  let count = Number(responseData?.count ?? 1);

  if (!qrBase64 && normalizedRaw) {
    const fullDataUriMatch = normalizedRaw.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i);
    if (fullDataUriMatch?.[0]) {
      qrBase64 = fullDataUriMatch[0];
    } else {
      const qrMatch = normalizedRaw.match(
        /"(?:base64|qrCode|qr_code|QR-CODE\(BASE64\))"\s*:\s*"([^"]+)"/i,
      );
      if (qrMatch?.[1]) qrBase64 = qrMatch[1];
    }
  }

  if (pairingCode == null && normalizedRaw) {
    const pairingMatch = normalizedRaw.match(/"(?:pairingCode|pairing_code)"\s*:\s*"([^"]+)"/i);
    if (pairingMatch?.[1]) pairingCode = pairingMatch[1];
  }

  if (code == null && normalizedRaw) {
    const codeMatch = normalizedRaw.match(/"code"\s*:\s*"([^"]+)"/i);
    if (codeMatch?.[1]) code = codeMatch[1];
  }

  if ((!Number.isFinite(count) || count < 1) && normalizedRaw) {
    const countMatch = normalizedRaw.match(/"count"\s*:\s*(\d+)/i);
    if (countMatch?.[1]) count = Number(countMatch[1]);
  }

  return {
    qrBase64,
    pairingCode,
    code,
    count: Number.isFinite(count) && count > 0 ? count : 1,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError ?? "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // Expect: { pairingCode, code, count, orgName, orgId, date, companyId }
    // Forward everything except base64 to the refresh webhook
    const { pairingCode, code, count, orgName, orgId, date, companyId } = body;

    const payload = {
      success: true,
      data: {
        pairingCode: pairingCode ?? null,
        code: code ?? null,
        count: count ?? 1,
      },
      orgName,
      orgId,
      date,
      companyId,
    };

    console.log("Refreshing QR code:", JSON.stringify(payload));

    let qrBase64: string | null = null;
    let nextPairingCode: string | null = null;
    let nextCode: string | null = null;
    let nextCount = 1;
    try {
      const res = await fetch(REFRESH_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text().catch(() => "");

      if (res.ok) {
        const data = parseWebhookResponse(rawText);
        const extracted = extractWebhookFields(rawText, data);
        qrBase64 = extracted.qrBase64;
        nextPairingCode = extracted.pairingCode;
        nextCode = extracted.code;
        nextCount = extracted.count;

        if (!qrBase64) {
          console.warn("Refresh response not JSON:", rawText.substring(0, 500));
        }
      } else {
        console.warn("Refresh webhook error:", res.status, rawText.substring(0, 500));
      }
    } catch (fetchErr) {
      console.warn("Refresh webhook fetch error:", fetchErr);
    }

    return new Response(JSON.stringify({
      success: !!qrBase64,
      qrCode: qrBase64,
      pairingCode: nextPairingCode,
      code: nextCode,
      count: nextCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
