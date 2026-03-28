import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://n8n.costazul.shop/webhook/WEBHOOK-WA-AGENT-PORT";

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
      throw new Error("EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY not configured");
    }
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

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

    // If instance exists in Evo, try to get QR code for reconnection
    if (existingInstance?.instance_name && existingInstance?.instance_token) {
      console.log("Attempting reconnect for existing instance:", existingInstance.instance_name);
      await sb.from("whatsapp_instances").update({ status: "connecting" }).eq("id", existingInstance.id);

      try {
        const connectRes = await fetch(`${baseUrl}/instance/connect/${existingInstance.instance_name}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const connectData = await connectRes.json().catch(() => ({}));
        console.log("Reconnect response:", connectRes.status, JSON.stringify(connectData).substring(0, 500));

        const qrBase64 = connectData?.base64 ?? connectData?.data?.base64 ?? null;
        if (qrBase64) {
          await sb.from("whatsapp_instances").update({
            qr_code: qrBase64,
            status: "connecting",
          }).eq("id", existingInstance.id);

          await auditLog(sb, orgId, "reconnect_evo", user.id, { hasQr: true });

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
      } catch (e) {
        console.warn("Reconnect failed, will create new instance:", e);
      }
    }

    const instanceName = existingInstance?.instance_name || `${orgSlug}-${org.id}`;
    console.log("Target instance name:", instanceName);

    // Set provisioning status in DB
    if (existingInstance?.id) {
      await sb.from("whatsapp_instances").update({
        status: "provisioning",
        instance_name: instanceName,
        qr_code: null,
        instance_token: existingInstance.instance_token ?? null,
      }).eq("id", existingInstance.id);
    } else {
      await sb.from("whatsapp_instances").insert({
        organization_id: orgId,
        instance_name: instanceName,
        status: "provisioning",
      });
    }

    // Check if instance already exists in Evolution API
    let instanceToken: string | null = existingInstance?.instance_token ?? null;
    let instanceExists = false;

    try {
      const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: EVOLUTION_API_KEY },
      });
      if (fetchRes.ok) {
        const fetchData = await fetchRes.json();
        const list = Array.isArray(fetchData)
          ? fetchData
          : Array.isArray(fetchData?.instances)
            ? fetchData.instances
            : fetchData?.instance
              ? [fetchData.instance]
              : [];

        const found = list.find((item: any) => {
          const name = item?.instanceName ?? item?.instance?.instanceName ?? item?.name;
          return name === instanceName;
        });

        if (found) {
          instanceExists = true;
          instanceToken =
            found?.apikey ??
            found?.token ??
            found?.instance?.apikey ??
            found?.instance?.token ??
            instanceToken;

          console.log("Instance already exists in Evo, reusing:", instanceName);

          await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              url: WEBHOOK_URL,
              byEvents: false,
              base64: true,
              events: ["MESSAGES_UPSERT"],
            }),
          });
        }
      }
    } catch (e) {
      console.warn("fetchInstances check failed, will try create:", e);
    }

    // Create only if it doesn't exist
    if (!instanceExists) {
      const createPayload = {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: true,
        webhook: {
          url: WEBHOOK_URL,
          byEvents: false,
          base64: true,
          headers: {},
          events: ["MESSAGES_UPSERT"],
        },
      };

      console.log("Creating new instance:", JSON.stringify(createPayload));
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify(createPayload),
      });

      const createRaw = await createRes.text();
      console.log("Evolution create response:", createRes.status, createRaw.substring(0, 1000));

      if (!createRes.ok) {
        const duplicateName = createRes.status === 403 && /already in use|already exists|em uso|já existe/i.test(createRaw);
        if (duplicateName) {
          console.warn("Instance name already exists in Evolution API, reusing existing instance:", instanceName);
          instanceExists = true;
        } else {
          throw new Error(`Evolution API create error [${createRes.status}]: ${createRaw.substring(0, 500)}`);
        }
      } else {
        let createData: any = {};
        try { createData = JSON.parse(createRaw); } catch { /* raw text */ }
        instanceToken = createData?.hash?.apikey ?? createData?.token ?? createData?.apikey ?? instanceToken;
      }
    }

    // Step 2: Connect instance to get QR code / current state
    const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
    });

    const connectRaw = await connectRes.text();
    console.log("Evolution connect response:", connectRes.status, connectRaw.substring(0, 500));

    let connectData: any = {};
    try { connectData = JSON.parse(connectRaw); } catch { /* raw text */ }

    const qrBase64 = connectData?.base64 ?? connectData?.data?.base64 ?? null;
    const evoState = String(connectData?.instance?.state ?? connectData?.state ?? "").toLowerCase();
    const isConnected = evoState === "open" || evoState === "connected";
    const instanceStatus = isConnected
      ? "connected"
      : (qrBase64 ? "connecting" : "provisioning");

    // Update DB with instance details
    const { data: currentInstance } = await sb
      .from("whatsapp_instances")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentInstance?.id) {
      const updatePayload: Record<string, any> = {
        instance_name: instanceName,
        status: instanceStatus,
      };
      if (instanceToken) updatePayload.instance_token = instanceToken;
      if (qrBase64) updatePayload.qr_code = qrBase64;

      await sb.from("whatsapp_instances").update(updatePayload).eq("id", currentInstance.id);
    }

    await auditLog(sb, orgId, "activate_evo_direct", user.id, {
      instanceName,
      hasToken: !!instanceToken,
      hasQr: !!qrBase64,
      state: evoState,
      isConnected,
      isReconnection: !!existingInstance,
    });

    return new Response(JSON.stringify({
      success: true,
      qrCode: qrBase64,
      connected: isConnected,
      status: instanceStatus,
      instanceCreated: !instanceExists,
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
