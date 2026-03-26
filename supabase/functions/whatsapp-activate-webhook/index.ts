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

const parseWebhookResponse = (rawText: string): any | null => {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  let parsed = tryParseJson(trimmed);

  // Alguns webhooks retornam JSON serializado como string (JSON dentro de JSON)
  if (typeof parsed === "string") {
    const nested = tryParseJson(parsed.trim());
    if (nested !== null) parsed = nested;
  }

  if (parsed !== null) return parsed;

  // Fallback para conteúdo entre aspas sem escape consistente
  const unquoted = trimmed.replace(/^\s*"|"\s*$/g, "").trim();
  if (unquoted && unquoted !== trimmed) {
    parsed = tryParseJson(unquoted);
    if (parsed !== null) return parsed;
  }

  return null;
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

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const dateStr = `${dd}${mm}${yyyy}`;

    const payload = {
      orgName,
      orgId: orgSequential,
      date: dateStr,
      companyId: org.id,
    };

    console.log("Sending webhook:", JSON.stringify(payload));

    let webhookData: any = null;
    let webhookStatus = "sent";
    try {
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      webhookStatus = webhookRes.ok ? "ok" : `http_${webhookRes.status}`;
      const webhookText = await webhookRes.text().catch(() => "");

      if (webhookRes.ok) {
        webhookData = parseWebhookResponse(webhookText);
        if (!webhookData) {
          console.warn("Webhook response not JSON:", webhookText);
        }
      } else {
        console.warn("Webhook non-ok response:", webhookRes.status, webhookText);
      }
    } catch (fetchErr) {
      console.warn("Webhook fetch error (continuing):", fetchErr);
      webhookStatus = "fetch_error";
    }

    // Extract QR code data — N8N may return an array or a single object
    const responseObj = Array.isArray(webhookData) ? webhookData[0] : webhookData;
    const responseData = responseObj?.data ?? responseObj;
    const qrBase64 = responseData?.base64 ??
      responseData?.qrCode ??
      responseData?.qr_code ??
      responseData?.["QR-CODE(BASE64)"] ??
      responseObj?.["QR-CODE(BASE64)"] ??
      null;
    const pairingCode = responseData?.pairingCode ?? responseData?.pairing_code ?? null;
    const code = responseData?.code ?? null;
    const count = Number(responseData?.count ?? 1);

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
