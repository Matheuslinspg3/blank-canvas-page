import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_BASE = "https://n8n.costazul.shop/webhook";
const N8N_CRIAR = `${N8N_BASE}/autouazapiagenteiavalent`;
const N8N_QR_CODE = `${N8N_BASE}/autouazapiagenteiavalentQR-CODE`;
const N8N_UNIFIED_WEBHOOK = `${N8N_BASE}/whatsapp-unified`;

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
      .select("id, name, slug")
      .eq("id", orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgSlug = org.slug ||
      org.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase()
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    // Check existing instance
    const { data: existingInstance } = await sb
      .from("whatsapp_instances")
      .select("id, instance_name, status, qr_code, phone_number, instance_token")
      .eq("organization_id", orgId)
      .maybeSingle();

    // Idempotency: already connected
    if (existingInstance?.status === "connected" && existingInstance?.instance_token) {
      await auditLog(sb, orgId, "activate_idempotent", user.id, { reason: "already_connected" });
      return new Response(JSON.stringify({
        success: true,
        qrCode: null,
        connected: true,
        status: "connected",
        instanceCreated: false,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If instance exists but disconnected, try to reconnect via N8N QR-CODE webhook
    if (existingInstance?.instance_name) {
      console.log("Reconnecting existing instance via N8N:", existingInstance.instance_name);

      await sb.from("whatsapp_instances").update({ status: "connecting" }).eq("id", existingInstance.id);

      try {
        const qrRes = await fetch(N8N_QR_CODE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName: existingInstance.instance_name }),
        });

        const qrData = await qrRes.text();
        console.log("N8N QR-CODE response:", qrRes.status, qrData.substring(0, 500));

        if (qrRes.ok) {
          let parsed: any = {};
          try { parsed = JSON.parse(qrData); } catch { /* raw */ }

          const qrBase64 = parsed?.["QR-CODE(BASE64)"] ?? parsed?.base64 ?? parsed?.data?.base64 ?? null;

          if (qrBase64) {
            await sb.from("whatsapp_instances").update({
              qr_code: qrBase64,
              status: "connecting",
            }).eq("id", existingInstance.id);

            await auditLog(sb, orgId, "reconnect_n8n", user.id, { hasQr: true });

            return new Response(JSON.stringify({
              success: true,
              qrCode: qrBase64,
              connected: false,
              status: "connecting",
              instanceCreated: false,
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.warn("Failed to reconnect via N8N, will create new:", e);
      }
    }

    // ── Create new instance via N8N CRIAR webhook ──
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "");

    const n8nPayload = {
      orgName: orgSlug,
      orgId: org.id,
      date: today,
      companyId: org.id,
    };

    console.log("Calling N8N CRIAR webhook:", JSON.stringify(n8nPayload));

    // Set provisioning status
    if (existingInstance?.id) {
      await sb.from("whatsapp_instances").update({ status: "provisioning" }).eq("id", existingInstance.id);
    } else {
      await sb.from("whatsapp_instances").insert({
        organization_id: orgId,
        instance_name: `${orgSlug}-${today}-${org.id}`,
        status: "provisioning",
      });
    }

    const criarRes = await fetch(N8N_CRIAR, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    const criarRaw = await criarRes.text();
    console.log("N8N CRIAR response:", criarRes.status, criarRaw.substring(0, 1000));

    if (!criarRes.ok) {
      throw new Error(`N8N CRIAR error [${criarRes.status}]: ${criarRaw.substring(0, 500)}`);
    }

    let criarData: any = {};
    try { criarData = JSON.parse(criarRaw); } catch { /* raw text */ }

    const whatsappName = criarData?.WhatsappName ?? null;
    const whatsappId = criarData?.WhatsappId ?? null;
    const qrBase64 = criarData?.["QR-CODE(BASE64)"] ?? null;

    // Update DB with response from N8N
    const { data: currentInstance } = await sb
      .from("whatsapp_instances")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentInstance?.id) {
      const updatePayload: Record<string, any> = {
        status: qrBase64 ? "connecting" : "provisioning",
      };
      if (whatsappName) updatePayload.instance_name = whatsappName;
      if (whatsappId) updatePayload.instance_token = whatsappId;
      if (qrBase64) updatePayload.qr_code = qrBase64;

      await sb.from("whatsapp_instances").update(updatePayload).eq("id", currentInstance.id);
    }

    await auditLog(sb, orgId, "activate_n8n", user.id, {
      hasQr: !!qrBase64,
      whatsappName,
      whatsappId,
      isReconnection: !!existingInstance,
    });

    return new Response(JSON.stringify({
      success: true,
      qrCode: qrBase64,
      connected: false,
      status: qrBase64 ? "connecting" : "provisioning",
      instanceCreated: !existingInstance,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
