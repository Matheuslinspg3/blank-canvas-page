import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  "https://n8n.costazul.shop/webhook/autouazapiagenteiavalent";

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

    const sb = createServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await sb
      .from("organizations")
      .select("id, name, slug, created_at")
      .eq("id", orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgName = org.slug ||
      org.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "");

    const { count: orgCount } = await sb
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .lte("created_at", org.created_at);
    const orgSequential = String(orgCount ?? 1).padStart(3, "0");

    const payload = {
      orgName,
      orgId: orgSequential,
      companyId: org.id,
    };

    // Check if instance already exists in our DB
    const { data: existingInstance } = await sb
      .from("whatsapp_instances")
      .select("id, instance_name, status, qr_code, phone_number")
      .eq("organization_id", orgId)
      .maybeSingle();

    console.log("Sending webhook:", JSON.stringify(payload), "existing:", existingInstance?.id ?? "none");

    let webhookData: any = null;
    let webhookStatus = "sent";
    let webhookTextRaw = "";
    try {
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      webhookStatus = webhookRes.ok ? "ok" : `http_${webhookRes.status}`;
      webhookTextRaw = await webhookRes.text().catch(() => "");

      if (webhookRes.ok) {
        webhookData = parseWebhookResponse(webhookTextRaw);
        if (!webhookData) {
          console.warn("Webhook response not JSON:", webhookTextRaw.substring(0, 500));
        }
      } else {
        console.warn("Webhook non-ok response:", webhookRes.status, webhookTextRaw.substring(0, 500));
      }
    } catch (fetchErr) {
      console.warn("Webhook fetch error (continuing):", fetchErr);
      webhookStatus = "fetch_error";
    }

    // Detect if N8N returned an existing instance (has Setting, _count, instanceId patterns)
    const webhookResponseObj = Array.isArray(webhookData) ? webhookData[0] : webhookData;
    const deepObj = Array.isArray(webhookResponseObj) ? webhookResponseObj[0] : webhookResponseObj;

    const alreadyExists =
      deepObj?.error?.toLowerCase?.()?.includes?.("já existe") ||
      deepObj?.error?.toLowerCase?.()?.includes?.("already exists") ||
      deepObj?.message?.toLowerCase?.()?.includes?.("já existe") ||
      deepObj?.exists === true ||
      // N8N returns Setting/instanceId when instance already exists
      !!deepObj?.Setting?.instanceId ||
      !!deepObj?.instanceId ||
      !!deepObj?.instance?.instanceId ||
      (deepObj?._count && typeof deepObj._count === "object");

    if (alreadyExists && !existingInstance) {
      const instanceId = deepObj?.Setting?.instanceId ?? deepObj?.instanceId ?? deepObj?.instance?.instanceId ?? null;
      const instanceName = deepObj?.instanceName ?? deepObj?.instance?.instanceName ?? deepObj?.name ?? `${orgName}-instance`;
      const instanceToken = deepObj?.token ?? deepObj?.instance?.token ?? deepObj?.apikey ?? null;
      await sb.from("whatsapp_instances").insert({
        organization_id: orgId,
        instance_name: instanceName,
        instance_token: instanceToken,
        status: "disconnected",
      });
      console.log("Created local record for existing N8N instance:", instanceName, "extId:", instanceId);
    } else if (alreadyExists && existingInstance) {
      console.log("Instance already exists locally and on N8N, skipping creation");
    }

    const { qrBase64, pairingCode, code, count } = extractWebhookFields(
      webhookTextRaw,
      webhookData,
    );

    return new Response(JSON.stringify({
      success: true,
      webhookStatus,
      payload,
      qrCode: qrBase64,
      pairingCode,
      code,
      count,
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
