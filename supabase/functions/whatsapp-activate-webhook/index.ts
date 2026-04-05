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

const parseJsonSafely = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const extractPairingCode = (payload: any) => {
  const candidates = [
    payload?.pairingCode,
    payload?.pairing_code,
    payload?.data?.pairingCode,
    payload?.data?.pairing_code,
    payload?.response?.pairingCode,
    payload?.response?.pairing_code,
    payload?.qrcode?.pairingCode,
    payload?.data?.qrcode?.pairingCode,
    payload?.code,
    payload?.data?.code,
    payload?.response?.code,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized || normalized.startsWith("data:image") || normalized.length > 128) continue;
    return normalized;
  }

  return null;
};

const extractQrBase64 = (payload: any) => {
  const candidates = [
    payload?.base64,
    payload?.data?.base64,
    payload?.qrcode?.base64,
    payload?.data?.qrcode?.base64,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }

  return null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectEvolutionInstance = async (
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  phoneNumber: string | null,
  retries = 0,
) => {
  let attempt = 0;
  const cleanPhone = phoneNumber?.replace(/\D/g, "") ?? null;

  while (true) {
    const requestVariants = cleanPhone
      ? [
          {
            label: "get_query_number",
            request: () => fetch(`${baseUrl}/instance/connect/${instanceName}?number=${encodeURIComponent(cleanPhone)}`, {
              method: "GET",
              headers: { apikey: apiKey },
            }),
          },
          {
            label: "post_body_number",
            request: () => fetch(`${baseUrl}/instance/connect/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: cleanPhone }),
            }),
          },
          {
            label: "post_request_code",
            request: () => fetch(`${baseUrl}/instance/${instanceName}/requestCode`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ phone: cleanPhone, number: cleanPhone }),
            }),
          },
        ]
      : [
          {
            label: "get_qr",
            request: () => fetch(`${baseUrl}/instance/connect/${instanceName}`, {
              method: "GET",
              headers: { apikey: apiKey },
            }),
          },
        ];

    let bestResult: any = null;

    for (const variant of requestVariants) {
      const connectRes = await variant.request();
      const connectRaw = await connectRes.text();
      const connectData = parseJsonSafely(connectRaw);
      const pairingCode = cleanPhone ? extractPairingCode(connectData) : null;
      const qrBase64 = extractQrBase64(connectData);
      const evoState = String(connectData?.instance?.state ?? connectData?.state ?? "").toLowerCase();
      const isConnected = evoState === "open" || evoState === "connected";

      bestResult = {
        method: variant.label,
        status: connectRes.status,
        connectRaw,
        connectData,
        pairingCode,
        qrBase64,
        evoState,
        isConnected,
      };

      if (cleanPhone) {
        if (isConnected || pairingCode) {
          return bestResult;
        }
      } else if (isConnected || qrBase64) {
        return bestResult;
      }
    }

    if (attempt >= retries) {
      return bestResult;
    }

    attempt += 1;
    await delay(1500);
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

    // Parse optional phone_number from request body
    let phoneNumber: string | null = null;
    try {
      const body = await req.json();
      phoneNumber = body?.phone_number ?? null;
    } catch { /* no body or invalid json — QR mode */ }

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

    // Check existing config (unified table)
    const { data: existing } = await sb
      .from("whatsapp_agent_config")
      .select("id, instance_name, status, qr_code, phone_number, instance_token")
      .eq("organization_id", orgId)
      .maybeSingle();

    // Idempotency: already connected
    if (existing?.status === "connected" && existing?.instance_token) {
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
    if (existing?.instance_name && existing?.instance_token) {
      console.log("Attempting reconnect for existing instance:", existing.instance_name);
      await sb.from("whatsapp_agent_config").update({ status: "connecting" }).eq("id", existing.id);

      try {
        const connectResult = await connectEvolutionInstance(
          baseUrl,
          EVOLUTION_API_KEY,
          existing.instance_name,
          phoneNumber,
          phoneNumber ? 2 : 0,
        );

        console.log("Reconnect response:", JSON.stringify({
          method: connectResult.method,
          status: connectResult.status,
          state: connectResult.evoState,
          hasQr: !!connectResult.qrBase64,
          hasPairingCode: !!connectResult.pairingCode,
          raw: connectResult.connectRaw.substring(0, 500),
        }));

        if (connectResult.isConnected || connectResult.pairingCode || connectResult.qrBase64) {
          const updatePayload: Record<string, any> = {
            status: connectResult.isConnected ? "connected" : "connecting",
            qr_code: connectResult.qrBase64 ?? null,
          };
          if (phoneNumber) updatePayload.phone_number = phoneNumber.replace(/\D/g, "");
          await sb.from("whatsapp_agent_config").update(updatePayload).eq("id", existing.id);

          await auditLog(sb, orgId, "reconnect_evo", user.id, {
            hasQr: !!connectResult.qrBase64,
            hasPairingCode: !!connectResult.pairingCode,
            state: connectResult.evoState,
            isConnected: connectResult.isConnected,
          });

          return new Response(JSON.stringify({
            success: true,
            qrCode: connectResult.qrBase64,
            pairingCode: connectResult.pairingCode,
            connected: connectResult.isConnected,
            status: connectResult.isConnected ? "connected" : "connecting",
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

    const instanceName = existing?.instance_name || `${orgSlug}-${org.id}`;
    console.log("Target instance name:", instanceName);

    // Set provisioning status in DB
    if (existing?.id) {
      await sb.from("whatsapp_agent_config").update({
        status: "provisioning",
        instance_name: instanceName,
        qr_code: null,
        instance_token: existing.instance_token ?? null,
      }).eq("id", existing.id);
    } else {
      await sb.from("whatsapp_agent_config").insert({
        organization_id: orgId,
        instance_name: instanceName,
        status: "provisioning",
      });
    }

    // Check if instance already exists in Evolution API
    let instanceToken: string | null = existing?.instance_token ?? null;
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

    // Step 2: Connect instance — pairing code (POST with phone) or QR code (GET)
    const connectResult = await connectEvolutionInstance(
      baseUrl,
      EVOLUTION_API_KEY,
      instanceName,
      phoneNumber,
      phoneNumber ? 2 : 0,
    );

    console.log("Evolution connect response:", JSON.stringify({
      method: connectResult.method,
      status: connectResult.status,
      state: connectResult.evoState,
      hasQr: !!connectResult.qrBase64,
      hasPairingCode: !!connectResult.pairingCode,
      raw: connectResult.connectRaw.substring(0, 500),
    }));

    const pairingCode = connectResult.pairingCode;
    const qrBase64 = connectResult.qrBase64;
    const evoState = connectResult.evoState;
    const isConnected = connectResult.isConnected;
    const instanceStatus = isConnected
      ? "connected"
      : ((phoneNumber || qrBase64 || pairingCode) ? "connecting" : "provisioning");

    // Update DB
    const { data: currentConfig } = await sb
      .from("whatsapp_agent_config")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentConfig?.id) {
      const updatePayload: Record<string, any> = {
        instance_name: instanceName,
        status: instanceStatus,
        qr_code: qrBase64 ?? null,
      };
      if (instanceToken) updatePayload.instance_token = instanceToken;
      if (phoneNumber) updatePayload.phone_number = phoneNumber.replace(/\D/g, "");

      await sb.from("whatsapp_agent_config").update(updatePayload).eq("id", currentConfig.id);
    }

    await auditLog(sb, orgId, "activate_evo_direct", user.id, {
      instanceName,
      hasToken: !!instanceToken,
      hasQr: !!qrBase64,
      hasPairingCode: !!pairingCode,
      state: evoState,
      isConnected,
      isReconnection: !!existing,
    });

    return new Response(JSON.stringify({
      success: true,
      qrCode: qrBase64,
      pairingCode,
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
