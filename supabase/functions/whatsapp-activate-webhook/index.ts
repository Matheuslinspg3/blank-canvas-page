import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_GLOBAL_KEY não configurados");
    }

    console.log("Evolution config:", {
      url: EVOLUTION_API_URL,
      keyLength: EVOLUTION_API_KEY.length,
      keyPrefix: EVOLUTION_API_KEY.substring(0, 6),
      keySuffix: EVOLUTION_API_KEY.substring(EVOLUTION_API_KEY.length - 4),
    });

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
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

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

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const instanceName = `${orgSlug}-wa`;

    // If instance exists but disconnected, try to reconnect (get new QR)
    if (existingInstance?.instance_token) {
      console.log("Reconnecting existing instance:", instanceName);

      await sb.from("whatsapp_instances").update({ status: "connecting" }).eq("id", existingInstance.id);

      // Try to connect existing instance to get QR
      try {
        const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });

        const connectData = await connectRes.json().catch(() => ({}));
        console.log("Connect response:", JSON.stringify(connectData).substring(0, 500));

        const qrBase64 = connectData?.base64 ?? connectData?.qrcode?.base64 ?? connectData?.code ?? null;
        const pairingCode = connectData?.pairingCode ?? null;

        if (qrBase64) {
          await sb.from("whatsapp_instances").update({
            qr_code: qrBase64,
            status: "connecting",
          }).eq("id", existingInstance.id);

          await auditLog(sb, orgId, "reconnect", user.id, { hasQr: true });

          return new Response(JSON.stringify({
            success: true,
            qrCode: qrBase64,
            pairingCode,
            connected: false,
            status: "connecting",
            instanceCreated: false,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If connect didn't return QR, check if already connected
        const state = String(connectData?.state ?? connectData?.instance?.state ?? "").toLowerCase();
        if (state === "open" || state === "connected") {
          await sb.from("whatsapp_instances").update({ status: "connected", qr_code: null }).eq("id", existingInstance.id);
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
      } catch (e) {
        console.warn("Failed to reconnect, will create new instance:", e);
      }

      // If reconnect failed, delete old instance on Evolution and create new
      try {
        await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
      } catch { /* ignore */ }
    }


    console.log("Evolution API URL:", baseUrl);
    console.log("Evolution API Key length:", EVOLUTION_API_KEY.length, "prefix:", EVOLUTION_API_KEY.substring(0, 4));

    console.log("Creating new Evolution API instance:", instanceName);

    // Set provisioning status
    if (existingInstance?.id) {
      await sb.from("whatsapp_instances").update({ status: "provisioning" }).eq("id", existingInstance.id);
    } else {
      await sb.from("whatsapp_instances").insert({
        organization_id: orgId,
        instance_name: instanceName,
        status: "provisioning",
      });
    }

    const webhookUrl = `https://n8n.costazul.shop/webhook/${instanceName}`;

    const createPayload = {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      groupsIgnore: true,
      syncFullHistory: true,
      rejectCall: false,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          "MESSAGES_UPSERT",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
        ],
      },
    };

    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify(createPayload),
    });

    const createRaw = await createRes.text();
    console.log("Evolution create response:", createRaw.substring(0, 1000));

    let createData: any;
    try {
      createData = JSON.parse(createRaw);
    } catch {
      createData = {};
    }

    if (!createRes.ok) {
      // If instance already exists on Evolution, try connect instead
      const isDuplicate = createRes.status === 403 || createRes.status === 409 ||
        /already|exists|duplicate/i.test(createRaw);

      if (isDuplicate) {
        console.log("Instance already exists on Evolution, fetching QR via connect...");
        const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const connectData = await connectRes.json().catch(() => ({}));
        createData = connectData;
      } else {
        throw new Error(`Evolution API error [${createRes.status}]: ${createRaw.substring(0, 500)}`);
      }
    }

    // Extract QR code and token from response
    const qrBase64 =
      createData?.qrcode?.base64 ??
      createData?.base64 ??
      createData?.qrCode ??
      createData?.qr_code ??
      null;

    const instanceToken =
      createData?.hash ??
      createData?.token ??
      createData?.instance?.token ??
      createData?.apikey ??
      null;

    const pairingCode =
      createData?.qrcode?.pairingCode ??
      createData?.pairingCode ??
      null;

    // Update DB with token and QR
    const { data: currentInstance } = await sb
      .from("whatsapp_instances")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentInstance?.id) {
      const updatePayload: Record<string, any> = {
        instance_name: instanceName,
        status: qrBase64 ? "connecting" : "provisioning",
      };
      if (instanceToken) updatePayload.instance_token = instanceToken;
      if (qrBase64) updatePayload.qr_code = qrBase64;

      await sb.from("whatsapp_instances").update(updatePayload).eq("id", currentInstance.id);
    }

    await auditLog(sb, orgId, "activate", user.id, {
      hasToken: !!instanceToken,
      hasQr: !!qrBase64,
      isReconnection: !!existingInstance,
    });

    return new Response(JSON.stringify({
      success: true,
      qrCode: qrBase64,
      pairingCode,
      connected: false,
      status: qrBase64 ? "connecting" : "provisioning",
      instanceCreated: !existingInstance,
      payload: { orgName: orgSlug, orgId: org.id, companyId: org.id },
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
