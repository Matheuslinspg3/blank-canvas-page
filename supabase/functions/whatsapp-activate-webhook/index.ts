import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";
import { 
  corsHeaders, 
  parseJsonSafely, 
  extractPairingCode, 
  extractQrBase64, 
  jsonResponse,
  errorResponse,
  AppError
} from "../_shared/whatsapp.ts";

const buildDebugRef = () => `ERR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

const normalizeInstancesList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.instances)) return data.instances;
  if (data?.instance) return Array.isArray(data.instance) ? data.instance : [data.instance];
  if (data?.data) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data.instances)) return data.data.instances;
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

const createEvolutionInstance = async (
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
  webhookSecret: string,
) => {
  // Evolution API v2.4.0 is very sensitive. 
  // We use 'instanceName' as the primary identifier.
  // We also provide a token to ensure the integration session has a valid key.
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const payload = {
    instanceName,
    token,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    syncFullHistory: false,
  };


  try {
    console.log(`[createEvolutionInstance] POST to ${baseUrl}/instance/create with payload keys: ${Object.keys(payload).join(", ")}`);
    
    const res = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });
    
    const raw = await res.text();
    const data = parseJsonSafely(raw);
    
    // We try to extract data even if status is not 2xx, 
    // as some versions return 400 with partial success or useful info.
    const token = data?.hash?.apikey ?? data?.token ?? data?.apikey ?? data?.instance?.apikey ?? null;
    const qrBase64 = extractQrBase64(data);
    const pairingCode = extractPairingCode(data);
    
    // If the creation was successful or returned a token/QR, we proceed to set the webhook
    if (res.ok || token || qrBase64) {
      console.log(`[createEvolutionInstance] Instance created or token found, configuring webhook...`);
      await configureEvolutionWebhook(baseUrl, apiKey, instanceName, webhookUrl, webhookSecret);
    }
    
    return { res, raw, token, qrBase64, pairingCode };
  } catch (e) {
    console.error("[createEvolutionInstance] unexpected error:", e);
    return { res: { ok: false, status: 500 }, raw: String(e), token: null, qrBase64: null, pairingCode: null };
  }
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  const dRef = buildDebugRef();

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const WHATSAPP_AGENT_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new AppError("MISSING_EVOLUTION_CONFIG", "Configuração da Evolution API ausente.", 422, dRef);
    }
    if (!SUPABASE_URL || !WHATSAPP_AGENT_SECRET) {
      throw new AppError("MISSING_WEBHOOK_CONFIG", "Configuração de Webhook ausente.", 422, dRef);
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const WEBHOOK_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/whatsapp-persist-message`;

    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) throw new AppError("UNAUTHORIZED", "Falha na autenticação.", 401, dRef);

    const sb = createServiceClient();
    const { data: profile } = await sb.from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new AppError("ORGANIZATION_NOT_FOUND", "Organização do perfil não encontrada.", 404, dRef);

    const { data: org } = await sb.from("organizations").select("id, name, slug").eq("id", profile.organization_id).single();
    if (!org) throw new AppError("ORGANIZATION_NOT_FOUND", "Organização não encontrada.", 404, dRef);

    const orgId = org.id;
    const orgSlug = org.slug || org.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "");
    const baseInstanceName = `${orgSlug}-${orgId}`;

    const { data: existingConfig } = await sb.from("whatsapp_agent_config").select("*").eq("organization_id", orgId).maybeSingle();
    let instanceName = typeof existingConfig?.instance_name === "string" && existingConfig.instance_name.trim()
      ? existingConfig.instance_name.trim()
      : baseInstanceName;

    if (!instanceName || typeof instanceName !== "string" || !instanceName.trim()) {
      throw new AppError("INVALID_INSTANCE_NAME", "Nome da instância inválido.", 400, dRef);
    }
    instanceName = instanceName.trim();


    let phoneNumber: string | null = null;
    let forceNewInstance = false;
    try {
      const body = await req.json();
      phoneNumber = body?.phone_number ?? null;
      forceNewInstance = !!body?.force_new_instance;
    } catch { /* QR mode */ }


    console.log(`[${dRef}] Action: Activate. Instance: ${instanceName}. ForceNew: ${forceNewInstance}`);
    
    let instanceExists = false;
    let instanceToken: string | null = null;

    if (!forceNewInstance) {
      console.log(`[${dRef}] Preflight: Fetching instances to check for ${instanceName}`);
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
          console.log(`[${dRef}] Instance already exists on Evolution.`);
        }
      }
    } else {
      console.log(`[${dRef}] force_new_instance=true, skipping fetchInstances and proceeding to cleanup/create.`);
    }


    let initialQr: string | null = null;
    let initialPairing: string | null = null;

    if (instanceExists) {
      console.log(`[${dRef}] Configuring webhook for existing instance ${instanceName}`);
      await configureEvolutionWebhook(baseUrl, EVOLUTION_API_KEY, instanceName, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
    } else {
      const tryCreate = async (name: string) => {
        console.log(`[${dRef}] Creating instance ${name}`);
        return await createEvolutionInstance(baseUrl, EVOLUTION_API_KEY, name, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
      };

      const cleanupOrphan = async (name: string) => {
        console.log(`[${dRef}] Cleanup orphan session for ${name}`);
        try {
          await fetch(`${baseUrl}/instance/logout/${name}`, { method: "DELETE", headers: { apikey: EVOLUTION_API_KEY } });
        } catch (_) { /* ignore */ }
        try {
          await fetch(`${baseUrl}/instance/delete/${name}`, { method: "DELETE", headers: { apikey: EVOLUTION_API_KEY } });
        } catch (_) { /* ignore */ }
        await delay(800);
      };

      let createAttempt = await tryCreate(instanceName);

      // Auto-recovery: orphan Prisma session (400, 403 or 409)
      if (!createAttempt.res.ok && (createAttempt.res.status === 400 || createAttempt.res.status === 403 || createAttempt.res.status === 409)) {
        const isConflict = /prisma|integrationSession|findFirst|already in use|already exists/i.test(createAttempt.raw);
        if (isConflict) {
          await cleanupOrphan(instanceName);
          createAttempt = await tryCreate(instanceName);

          // Second fallback: unique name
          if (!createAttempt.res.ok) {
            const fallbackName = `${baseInstanceName}-${Math.random().toString(36).substring(2, 7)}`;
            console.log(`[${dRef}] Fallback to unique instance name ${fallbackName}`);
            instanceName = fallbackName;
            createAttempt = await tryCreate(instanceName);
          }
        }
      }

      if (createAttempt.res.ok) {
        instanceToken = createAttempt.token;
        initialQr = createAttempt.qrBase64;
        initialPairing = createAttempt.pairingCode;
      } else {
        const isConflict = /prisma|integrationSession|findFirst/i.test(createAttempt.raw);
        if (isConflict) {
          // Returning 200 with error payload to avoid breaking UI with 409
          return jsonResponse({
            ok: false,
            code: "EVOLUTION_INSTANCE_CONFLICT",
            message: "Encontramos uma sessão antiga na Evolution que não pôde ser limpa automaticamente. Tente remover a conexão local para sincronizar.",
            debug_ref: dRef,
            recoverable: true
          });
        }
        
        const status = createAttempt.res.status;
        if (status === 401) throw new AppError("EVOLUTION_UNAUTHORIZED", "A Evolution API recusou a autenticação.", 401, dRef);
        throw new AppError("EVOLUTION_CREATE_FAILED", "Falha ao criar instância na Evolution.", 502, dRef);
      }
    }

    let finalQr = initialQr;
    let finalPairing = initialPairing;

    // Se já existia ou se criamos mas não retornou o código de conexão esperado
    if (phoneNumber && !finalPairing) {
        const connRes = await fetch(`${baseUrl}/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`, {
            method: "GET",
            headers: { apikey: EVOLUTION_API_KEY },
        });
        const connData = parseJsonSafely(await connRes.text());
        finalPairing = extractPairingCode(connData);
    } else if (!phoneNumber && !finalQr) {
        const connRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: { apikey: EVOLUTION_API_KEY },
        });
        const connData = parseJsonSafely(await connRes.text());
        finalQr = extractQrBase64(connData);
    }

    const status = (finalQr || finalPairing) ? "connecting" : "provisioning";
    const dbPayload: any = {
      instance_name: instanceName,
      status,
      qr_code: finalQr ?? null,
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
      hasQr: !!finalQr,
      hasPairingCode: !!finalPairing,
      debug_ref: dRef
    });

    return jsonResponse({
      ok: true,
      qrCode: finalQr,
      pairingCode: finalPairing,
      status,
      instanceName,
      instanceCreated: !instanceExists,
      debug_ref: dRef
    });

  } catch (err: any) {
    console.error(`[${dRef}] whatsapp-activate-webhook error:`, err);
    if (err instanceof AppError) {
      return errorResponse(err.status, err.code, err.message, err.debug_ref);
    }
    // Para erros inesperados, retornamos 200 com ok: false para evitar o overlay de erro do preview
    return jsonResponse({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro interno ao processar a requisição.",
      debug_ref: dRef
    });
  }
});
