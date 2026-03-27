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

const asLowerText = (value: unknown): string => String(value ?? "").trim().toLowerCase();

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

const extractInstanceSnapshot = (webhookData: any) => {
  let root = webhookData;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(root) && root.length > 0) root = root[0];
    else break;
  }
  if (!root || typeof root !== "object") return null;

  let instanceObj: Record<string, any> | null = null;

  const dataField = root?.data;
  if (Array.isArray(dataField) && dataField.length > 0) {
    instanceObj = dataField[0];
  } else if (dataField && typeof dataField === "object" && !Array.isArray(dataField)) {
    instanceObj = dataField;
  }

  if (!instanceObj?.connectionStatus && !instanceObj?.token && root?.connectionStatus) {
    instanceObj = root;
  }

  if (!instanceObj) return null;

  const statusText = [
    instanceObj?.connectionStatus,
    instanceObj?.status,
    instanceObj?.state,
  ]
    .map(asLowerText)
    .join(" ");

  const connected =
    instanceObj?.connected === true ||
    /open|connected|ready|online|authorized/.test(statusText);

  let phoneNumber =
    instanceObj?.number ??
    instanceObj?.phone ??
    instanceObj?.phoneNumber ??
    null;

  if (!phoneNumber && typeof instanceObj?.ownerJid === "string") {
    phoneNumber = instanceObj.ownerJid.split("@")[0] || null;
  }

  const instanceName =
    instanceObj?.name ??
    instanceObj?.instanceName ??
    null;

  const instanceToken =
    instanceObj?.token ??
    instanceObj?.apikey ??
    null;

  return {
    connected,
    phoneNumber: typeof phoneNumber === "string" ? phoneNumber : null,
    instanceName: typeof instanceName === "string" ? instanceName : null,
    instanceToken: typeof instanceToken === "string" ? instanceToken : null,
  };
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

// Audit helper
const auditLog = async (
  sb: any,
  orgId: string,
  action: string,
  actorId: string | null,
  details: Record<string, any> = {},
) => {
  try {
    await sb.from("whatsapp_audit_log").insert({
      organization_id: orgId,
      action,
      actor_id: actorId,
      details,
    });
  } catch (e) {
    console.warn("Failed to write audit log:", e);
  }
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

    const { data: existingInstance } = await sb
      .from("whatsapp_instances")
      .select("id, instance_name, status, qr_code, phone_number, instance_token")
      .eq("organization_id", orgId)
      .maybeSingle();

    // Idempotency: if already connected, return current state without calling N8N
    if (existingInstance?.status === "connected" && existingInstance?.instance_token) {
      await auditLog(sb, orgId, "activate_idempotent", user.id, { reason: "already_connected" });
      return new Response(JSON.stringify({
        success: true,
        webhookStatus: "skipped",
        payload,
        qrCode: null,
        pairingCode: null,
        code: null,
        count: 0,
        connected: true,
        status: "connected",
        instanceCreated: false,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending webhook:", JSON.stringify(payload), "existing:", existingInstance?.id ?? "none");

    // Set status to provisioning immediately
    if (existingInstance?.id) {
      await sb.from("whatsapp_instances").update({ status: "provisioning" }).eq("id", existingInstance.id);
    } else {
      await sb.from("whatsapp_instances").insert({
        organization_id: orgId,
        instance_name: `${orgName}-instance`,
        status: "provisioning",
      });
    }

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

      console.log("Webhook raw response (first 1000):", webhookTextRaw.substring(0, 1000));

      if (webhookRes.ok) {
        webhookData = parseWebhookResponse(webhookTextRaw);
        if (!webhookData) {
          console.warn("Webhook response not parseable as JSON");
        }
      } else {
        console.warn("Webhook non-ok response:", webhookRes.status);
      }
    } catch (fetchErr) {
      console.warn("Webhook fetch error (continuing):", fetchErr);
      webhookStatus = "fetch_error";
    }

    const snapshot = extractInstanceSnapshot(webhookData);

    // Machine state: provisioning → connecting (got QR/token) or connected (already open)
    let nextStatus: string;
    if (snapshot?.connected) {
      nextStatus = "connected";
    } else if (snapshot?.instanceToken || webhookData) {
      nextStatus = "connecting";
    } else {
      nextStatus = "provisioning"; // N8N didn't respond yet
    }

    const nextInstanceName =
      snapshot?.instanceName ?? existingInstance?.instance_name ?? `${orgName}-instance`;
    const nextToken = snapshot?.instanceToken ?? existingInstance?.instance_token ?? null;
    const nextPhone = snapshot?.phoneNumber ?? existingInstance?.phone_number ?? null;

    const persistPayload: Record<string, any> = {
      instance_name: nextInstanceName,
      status: nextStatus,
    };

    if (nextToken) persistPayload.instance_token = nextToken;
    if (nextPhone) persistPayload.phone_number = nextPhone;
    if (nextStatus === "connected") persistPayload.qr_code = null;

    // Re-fetch to get the ID (may have been just created)
    const { data: currentInstance } = await sb
      .from("whatsapp_instances")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentInstance?.id) {
      await sb.from("whatsapp_instances").update(persistPayload).eq("id", currentInstance.id);
    }

    const { qrBase64, pairingCode, code, count } = extractWebhookFields(
      webhookTextRaw,
      webhookData,
    );

    // Save QR to DB if available
    if (qrBase64 && currentInstance?.id) {
      await sb.from("whatsapp_instances").update({ qr_code: qrBase64 }).eq("id", currentInstance.id);
    }

    // Audit log
    await auditLog(sb, orgId, "activate", user.id, {
      webhookStatus,
      nextStatus,
      hasToken: !!nextToken,
      hasQr: !!qrBase64,
      isReconnection: !!existingInstance,
    });

    return new Response(JSON.stringify({
      success: true,
      webhookStatus,
      payload,
      qrCode: qrBase64,
      pairingCode,
      code,
      count,
      connected: nextStatus === "connected",
      status: nextStatus,
      instanceCreated: !existingInstance,
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
