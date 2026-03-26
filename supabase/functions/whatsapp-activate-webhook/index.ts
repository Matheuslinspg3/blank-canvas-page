import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  "https://n8n.costazul.shop/webhook/autouazapiagenteiavalent";

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

    const { count } = await sb
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .lte("created_at", org.created_at);
    const orgSequential = String(count ?? 1).padStart(3, "0");

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
      if (webhookRes.ok) {
        try {
          webhookData = await webhookRes.json();
        } catch {
          const text = await webhookRes.text().catch(() => "");
          console.warn("Webhook response not JSON:", text);
        }
      } else {
        const text = await webhookRes.text().catch(() => "");
        console.warn("Webhook non-ok response:", webhookRes.status, text);
      }
    } catch (fetchErr) {
      console.warn("Webhook fetch error (continuing):", fetchErr);
      webhookStatus = "fetch_error";
    }

    // Extract QR code data from webhook response
    const qrBase64 = webhookData?.data?.base64 ?? null;
    const pairingCode = webhookData?.data?.pairingCode ?? null;
    const code = webhookData?.data?.code ?? null;

    return new Response(JSON.stringify({
      success: true,
      webhookStatus,
      payload,
      qrCode: qrBase64,
      pairingCode,
      code,
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
