import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";
import { 
  corsHeaders, 
  parseJsonSafely, 
  extractPairingCode, 
  extractQrBase64, 
  safePreview,
  classifyConnectionStatus
} from "../_shared/whatsapp.ts";

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
        const state = classifyConnectionStatus(
          raw,
          data?.instance?.state,
          data?.state,
          data?.status
        );
        const isConnected = state === "connected";

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
      enabled: true,
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
  const qrBase64 = extractQrBase64(data);
  const pairingCode = extractPairingCode(data);
  
  return { res, raw, token, qrBase64, pairingCode };
};


const configureEvolutionWebhook = (
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
  webhookSecret: string,
) => fetch(`${baseUrl}/webhook/set/${instanceName}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: apiKey },
  body: JSON.stringify({
    url: webhookUrl,
    enabled: true,
    byEvents: false,
    base64: true,
    headers: { "x-webhook-secret": webhookSecret },
    events: ["MESSAGES_UPSERT"],
  }),
});


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
      await configureEvolutionWebhook(baseUrl, EVOLUTION_API_KEY, instanceName, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
    } else {
      // Create Instance
      console.log(`Creating instance ${instanceName}`);
      const { res: createRes, raw: createRaw, token: createToken } = await createEvolutionInstance(
        baseUrl,
        EVOLUTION_API_KEY,
        instanceName,
        WEBHOOK_URL,
        WHATSAPP_AGENT_SECRET,
      );
      console.log(`Create status: ${createRes.status}. Preview: ${safePreview(createRaw, 500)}`);

      if (createRes.ok) {
        instanceToken = createToken;
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
            await configureEvolutionWebhook(baseUrl, EVOLUTION_API_KEY, instanceName, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
          }
        }

        // Fallback 2: orphan Prisma session — try DELETE + retry, then direct connect as last resort.
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

          const { res: retryRes, raw: retryRaw, token: retryToken } = await createEvolutionInstance(
            baseUrl,
            EVOLUTION_API_KEY,
            instanceName,
            WEBHOOK_URL,
            WHATSAPP_AGENT_SECRET,
          );
          console.log(`Retry create status: ${retryRes.status}. Preview: ${safePreview(retryRaw, 300)}`);

          if (retryRes.ok) {
            instanceToken = retryToken;
          } else {
            // Fallback 3: try direct connect — Evolution may have the instance row even though create returned 400.
            console.log(`Retry failed; attempting direct connect on ${instanceName} as last resort`);
            const directConnect = await connectEvolutionInstance(baseUrl, EVOLUTION_API_KEY, instanceName, phoneNumber);

            if (directConnect.success) {
              console.log("Direct connect succeeded — reusing orphan instance.");
              instanceExists = true;
              try {
                await configureEvolutionWebhook(baseUrl, EVOLUTION_API_KEY, instanceName, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
              } catch { /* ignore */ }
            } else {
              const conflictMessage = "A Evolution API manteve uma sessão órfã que não pôde ser recuperada automaticamente. Remova a instância no painel da Evolution e tente novamente.";
              return jsonResponse({
                success: false,
                recoverable: true,
                code: "EVOLUTION_INSTANCE_CONFLICT",
                message: conflictMessage,
                error: {
                  code: "EVOLUTION_INSTANCE_CONFLICT",
                  message: conflictMessage,
                },
              }, 200);
            }
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
