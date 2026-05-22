import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (status: number, code: string, message: string) =>
  jsonResponse({
    success: false,
    error: { code, message },
  }, status);

const safePreview = (value: unknown, limit = 1000) => {
  const text = String(value ?? "");
  if (/prismaRepository|integrationSession|findFirst|\/evolution\/dist\/main\.js/i.test(text)) {
    return "[Evolution internal error redacted]";
  }
  const masked = text
    .replace(/("?(?:apikey|api_key|token|authorization)"?\s*[:=]\s*")([^"\n]+)(")/gi, '$1***$3')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1***');
  return masked.substring(0, limit);
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
    payload?.code,
    payload?.data?.pairingCode,
    payload?.data?.pairing_code,
    payload?.data?.code,
    payload?.response?.pairingCode,
    payload?.response?.pairing_code,
    payload?.response?.code,
    payload?.qrcode?.pairingCode,
    payload?.data?.qrcode?.pairingCode,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized || normalized.startsWith("data:image") || normalized.length > 32) continue;
    return normalized;
  }
  return null;
};

const extractQrBase64 = (payload: any) => {
  const candidates = [
    payload?.base64,
    payload?.qrCode,
    payload?.qr_code,
    payload?.qrcode,
    payload?.qrcode?.base64,
    payload?.qrcode?.code,
    payload?.data?.base64,
    payload?.data?.qrCode,
    payload?.data?.qr_code,
    payload?.data?.qrcode,
    payload?.data?.qrcode?.base64,
    payload?.data?.qrcode?.code,
    payload?.response?.base64,
    payload?.response?.qrCode,
    payload?.response?.qrcode,
    payload?.response?.qrcode?.base64,
  ];

  for (const candidate of candidates) {
    let val = candidate;
    if (typeof val === "object" && val !== null) {
      val = val.base64 || val.code || val.qr || null;
    }
    if (typeof val !== "string") continue;
    const normalized = val.trim();
    if (normalized.length > 100) return normalized;
  }
  return null;
};

const normalizeInstancesList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.instances)) return data.instances;
  if (data?.instance) return Array.isArray(data.instance) ? data.instance : [data.instance];
  if (data?.data) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data.instances)) return data.data.instances;
  }
  if (data?.response) {
    if (Array.isArray(data.response)) return data.response;
    if (Array.isArray(data.response.instances)) return data.response.instances;
  }
  return [];
};

const findEvolutionInstance = (list: any[], instanceName: string) => {
  return list.find((item: any) => {
    const candidates = [
      item?.instanceName,
      item?.name,
      item?.id,
      item?.instance?.instanceName,
      item?.instance?.name,
      item?.instance?.id,
      item?.data?.instanceName,
      item?.data?.name,
    ];
    return candidates.some(c => String(c ?? "").trim() === instanceName);
  });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectEvolutionInstance = async (
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  phoneNumber: string | null,
) => {
  const cleanPhone = phoneNumber?.replace(/\D/g, "") ?? null;
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const variants = cleanPhone
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

    for (const variant of variants) {
      try {
        const res = await variant.request();
        const raw = await res.text();
        const data = parseJsonSafely(raw);
        
        const qrBase64 = extractQrBase64(data);
        const pairingCode = extractPairingCode(data);
        const state = String(data?.instance?.state ?? data?.state ?? data?.status ?? "").toLowerCase();
        const isConnected = ["open", "connected", "online", "ready"].includes(state);

        if (isConnected || qrBase64 || pairingCode) {
          return {
            success: true,
            isConnected,
            qrBase64,
            pairingCode,
            evoState: state,
            status: res.status,
            connectRaw: raw
          };
        }
      } catch (e) {
        console.warn(`Connect attempt ${attempt} variant ${variant.label} failed:`, e);
      }
    }

    if (attempt < maxRetries) await delay(1500);
  }

  return { success: false, isConnected: false };
};

const createEvolutionInstance = async (
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
  webhookSecret: string,
) => {
  const payload = {
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
      url: webhookUrl,
      byEvents: false,
      base64: true,
      headers: { "x-webhook-secret": webhookSecret },
      events: ["MESSAGES_UPSERT"],
    },
  };

  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  const data = parseJsonSafely(raw);
  const token = data?.hash?.apikey ?? data?.token ?? data?.apikey ?? null;
  return { res, raw, token };
};

const auditLog = async (sb: any, orgId: string, action: string, actorId: string | null, details: Record<string, any> = {}) => {
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Config validation
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const WHATSAPP_AGENT_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return errorResponse(422, "MISSING_EVOLUTION_CONFIG", "Missing Evolution API configuration (URL/Key)");
    }
    if (!SUPABASE_URL || !WHATSAPP_AGENT_SECRET) {
      return errorResponse(422, "MISSING_WEBHOOK_CONFIG", "Missing Webhook configuration (URL/Secret)");
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const WEBHOOK_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/whatsapp-persist-message`;

    // 2. Auth & Organization
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) return errorResponse(401, "UNAUTHORIZED", "Authentication failed");

    const sb = createServiceClient();
    const { data: profile } = await sb.from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) return errorResponse(404, "ORGANIZATION_NOT_FOUND", "Profile organization not found");

    const { data: org } = await sb.from("organizations").select("id, name, slug").eq("id", profile.organization_id).single();
    if (!org) return errorResponse(404, "ORGANIZATION_NOT_FOUND", "Organization not found");

    const orgId = org.id;
    const orgSlug = org.slug || org.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "");
    const baseInstanceName = `${orgSlug}-${orgId}`;

    // 3. Check current state
    const { data: existingConfig } = await sb.from("whatsapp_agent_config").select("*").eq("organization_id", orgId).maybeSingle();
    let instanceName = typeof existingConfig?.instance_name === "string" && existingConfig.instance_name.trim()
      ? existingConfig.instance_name.trim()
      : baseInstanceName;

    if (existingConfig?.status === "connected" && existingConfig?.instance_token) {
      return jsonResponse({
        success: true,
        qrCode: null,
        pairingCode: null,
        connected: true,
        status: "connected",
        instanceName,
        instanceCreated: false,
      });
    }

    // 4. Parse phone number if present
    let phoneNumber: string | null = null;
    try {
      const body = await req.json();
      phoneNumber = body?.phone_number ?? null;
    } catch { /* QR mode */ }

    // 5. Mandatory Preflight
    console.log(`Preflight: Fetching instances for ${instanceName}`);
    let instanceExists = false;
    let instanceToken: string | null = null;

    const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
    });

    if (fetchRes.ok) {
      const fetchData = await fetchRes.json();
      const list = normalizeInstancesList(fetchData);
      const found = findEvolutionInstance(list, instanceName);

      if (found) {
        instanceExists = true;
        instanceToken = found?.apikey ?? found?.token ?? found?.instance?.apikey ?? found?.instance?.token ?? null;
        console.log("Preflight: Instance found, reusing.");
      }
    }

    // 6. State Machine: Reuse or Create
    if (instanceExists) {
      // Configure Webhook
      console.log(`Configuring webhook for ${instanceName}`);
      await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          byEvents: false,
          base64: true,
          headers: { "x-webhook-secret": WHATSAPP_AGENT_SECRET },
          events: ["MESSAGES_UPSERT"],
        }),
      });
    } else {
      // Create Instance
      console.log(`Creating instance ${instanceName}`);
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
          headers: { "x-webhook-secret": WHATSAPP_AGENT_SECRET },
          events: ["MESSAGES_UPSERT"],
        },
      };

      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify(createPayload),
      });

      const createRaw = await createRes.text();
      console.log(`Create status: ${createRes.status}. Preview: ${safePreview(createRaw, 500)}`);

      if (createRes.ok) {
        const createData = parseJsonSafely(createRaw);
        instanceToken = createData?.hash?.apikey ?? createData?.token ?? createData?.apikey ?? null;
      } else if (createRes.status === 401) {
        return errorResponse(401, "EVOLUTION_UNAUTHORIZED", "A Evolution API recusou a autenticação. Verifique EVOLUTION_API_GLOBAL_KEY.");
      } else if (createRes.status === 400 || createRes.status === 403) {
        // Fallback 1: refetch (instance may already exist)
        console.log("Create failed with 400/403, refetching instances...");
        const refetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        if (refetchRes.ok) {
          const refetchData = await refetchRes.json();
          const refetchList = normalizeInstancesList(refetchData);
          const refound = findEvolutionInstance(refetchList, instanceName);
          if (refound) {
            instanceExists = true;
            instanceToken = refound?.apikey ?? refound?.token ?? refound?.instance?.apikey ?? refound?.instance?.token ?? null;
            await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({
                url: WEBHOOK_URL,
                byEvents: false,
                base64: true,
                headers: { "x-webhook-secret": WHATSAPP_AGENT_SECRET },
                events: ["MESSAGES_UPSERT"],
              }),
            });
          }
        }

        // Fallback 2: orphan Prisma session — instance not listed but stale rows exist.
        // Force-delete (logout + delete) and retry create.
        if (!instanceExists) {
          const isPrismaConflict = /prisma|integrationSession|findFirst/i.test(createRaw);
          console.log(`Orphan recovery: prismaConflict=${isPrismaConflict}, forcing DELETE on ${instanceName}`);

          try {
            await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
              method: "DELETE",
              headers: { apikey: EVOLUTION_API_KEY },
            }).then(r => r.text());
          } catch { /* ignore */ }
          try {
            await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
              method: "DELETE",
              headers: { apikey: EVOLUTION_API_KEY },
            }).then(r => r.text());
          } catch { /* ignore */ }

          await delay(1200);

          const retryRes = await fetch(`${baseUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify(createPayload),
          });
          const retryRaw = await retryRes.text();
          console.log(`Retry create status: ${retryRes.status}. Preview: ${safePreview(retryRaw, 300)}`);

          if (retryRes.ok) {
            const retryData = parseJsonSafely(retryRaw);
            instanceToken = retryData?.hash?.apikey ?? retryData?.token ?? retryData?.apikey ?? null;
          } else {
            return errorResponse(409, "EVOLUTION_INSTANCE_CONFLICT", "A Evolution API recusou a criação da instância mesmo após limpar sessão órfã. Tente novamente em instantes.");
          }
        }
      } else {
        return errorResponse(502, "EVOLUTION_CREATE_FAILED", "Não foi possível criar a instância na Evolution API. Tente novamente em instantes.");
      }
    }

    // 7. Connect (get QR or Pairing Code)
    const connectResult = await connectEvolutionInstance(baseUrl, EVOLUTION_API_KEY, instanceName, phoneNumber);
    
    if (!connectResult.success) {
      return errorResponse(502, "EVOLUTION_CONNECT_FAILED", "Não foi possível estabelecer conexão com a Evolution API.");
    }

    // 8. DB Update
    const status = connectResult.isConnected ? "connected" : (connectResult.qrBase64 || connectResult.pairingCode ? "connecting" : "provisioning");
    
    const dbPayload: any = {
      instance_name: instanceName,
      status,
      qr_code: connectResult.qrBase64 ?? null,
      updated_at: new Date().toISOString(),
    };
    if (instanceToken) dbPayload.instance_token = instanceToken;
    if (phoneNumber) dbPayload.phone_number = phoneNumber.replace(/\D/g, "");

    if (existingConfig) {
      await sb.from("whatsapp_agent_config").update(dbPayload).eq("id", existingConfig.id);
    } else {
      await sb.from("whatsapp_agent_config").insert({ ...dbPayload, organization_id: orgId });
    }

    await auditLog(sb, orgId, "activate_webhook", user.id, {
      instanceName,
      instanceCreated: !instanceExists,
      isConnected: connectResult.isConnected,
      hasQr: !!connectResult.qrBase64,
      hasPairingCode: !!connectResult.pairingCode
    });

    return jsonResponse({
      success: true,
      qrCode: connectResult.qrBase64,
      pairingCode: connectResult.pairingCode,
      connected: connectResult.isConnected,
      status,
      instanceName,
      instanceCreated: !instanceExists,
    });

  } catch (err: any) {
    console.error("Internal Error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Ocorreu um erro interno ao ativar o WhatsApp. Tente novamente em instantes.");
  }
});
