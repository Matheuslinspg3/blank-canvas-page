import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";
import { 
  corsHeaders, 
  parseJsonSafely, 
  extractPairingCode, 
  extractQrBase64, 
  jsonResponse,
  errorResponse,
  AppError,
  safePreview
} from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";

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
    const EVOLUTION_PROVIDER = (Deno.env.get("EVOLUTION_PROVIDER") || "evolution_node") as "evolution_node" | "evolution_go";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const WHATSAPP_AGENT_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new AppError("MISSING_EVOLUTION_CONFIG", "Configuração da Evolution API ausente.", 422, dRef);
    }
    if (!SUPABASE_URL || !WHATSAPP_AGENT_SECRET) {
      throw new AppError("MISSING_WEBHOOK_CONFIG", "Configuração de Webhook ausente.", 422, dRef);
    }

    const provider = new EvolutionProvider({
      baseUrl: EVOLUTION_API_URL,
      apiKey: EVOLUTION_API_KEY,
      provider: EVOLUTION_PROVIDER,
    });

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

    if (!instanceName || typeof instanceName !== "string" || !instanceName.trim() || instanceName.includes("undefined") || instanceName.length < 3) {
      throw new AppError("INVALID_INSTANCE_NAME", `Nome da instância inválido: ${String(instanceName)}`, 400, dRef);
    }

    instanceName = instanceName.trim();

    let phoneNumber: string | null = null;
    let forceNewInstance = false;
    try {
      const body = await req.json();
      phoneNumber = body?.phone_number ?? null;
      forceNewInstance = !!body?.force_new_instance;
    } catch { /* QR mode */ }

    console.log(`[${dRef}] Action: Activate. Provider: ${EVOLUTION_PROVIDER}. Instance: ${instanceName}. ForceNew: ${forceNewInstance}`);
    
    let instanceExists = false;
    let instanceToken: string | null = null;

    if (!forceNewInstance) {
      console.log(`[${dRef}] Preflight: Fetching instances to check for ${instanceName}`);
      const fetchRes = await provider.fetchInstances();

      if (fetchRes.ok) {
        const list = normalizeInstancesList(fetchRes.data);
        const found = findEvolutionInstance(list, instanceName);

        if (found) {
          instanceExists = true;
          instanceToken = found?.apikey ?? found?.token ?? found?.instance?.apikey ?? found?.instance?.token ?? null;
          console.log(`[${dRef}] Instance already exists on Evolution.`);
        }
      }
    }

    let initialQr: string | null = null;
    let initialPairing: string | null = null;

    if (instanceExists && !forceNewInstance) {
      console.log(`[${dRef}] Configuring webhook for existing instance ${instanceName}`);
      await provider.setWebhook(instanceName, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
    } else {
      if (forceNewInstance || instanceExists) {
        console.log(`[${dRef}] Cleaning up instance ${instanceName} before recreation...`);
        try {
          await provider.logout(instanceName);
          await provider.delete(instanceName);
          await delay(1000);
        } catch (_) { /* ignore */ }
      }

      const tryCreate = async (name: string) => {
        const res = await provider.createInstance(name);
        const data = res.data;
        const finalToken = data?.hash?.apikey ?? data?.token ?? data?.apikey ?? data?.instance?.apikey ?? null;
        const qrBase64 = extractQrBase64(data);
        const pairingCode = extractPairingCode(data);
        
        if (res.ok || qrBase64 || pairingCode) {
          await provider.setWebhook(name, WEBHOOK_URL, WHATSAPP_AGENT_SECRET);
        }
        
        return { res, raw: res.raw, token: finalToken, qrBase64, pairingCode };
      };

      const cleanupOrphan = async (name: string) => {
        console.log(`[${dRef}] Cleanup orphan session for ${name}`);
        try { await provider.logout(name); } catch (_) { /* ignore */ }
        try { await provider.delete(name); } catch (_) { /* ignore */ }
        await delay(800);
      };

      let createAttempt = await tryCreate(instanceName);

      if (!createAttempt.res.ok && (createAttempt.res.status === 400 || createAttempt.res.status === 403 || createAttempt.res.status === 409)) {
        const isConflict = /prisma|integrationSession|findFirst|already in use|already exists/i.test(createAttempt.raw);
        if (isConflict) {
          await cleanupOrphan(instanceName);
          createAttempt = await tryCreate(instanceName);

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
          return jsonResponse({
            ok: false,
            code: "EVO_GO_INSTANCE_CONFLICT",
            message: "A Evolution API retornou um erro interno de sessão. Tente remover a conexão local e iniciar uma nova.",
            debug_ref: dRef,
            recoverable: true
          });
        }
        throw new AppError("EVO_GO_INSTANCE_CREATE_FAILED", "Falha ao criar instância na Evolution.", 502, dRef);
      }

    }

    let finalQr = initialQr;
    let finalPairing = initialPairing;

    if (phoneNumber && !finalPairing) {
        const connRes = await provider.pair(instanceName, phoneNumber);
        if (!connRes.ok) {
           throw new AppError("EVO_GO_PAIRING_FAILED", "Falha ao gerar código de pareamento.", 502, dRef);
        }
        finalPairing = extractPairingCode(connRes.data);
    } else if (!phoneNumber && !finalQr) {
        const connRes = await provider.getQr(instanceName);
        if (!connRes.ok) {
           throw new AppError("EVO_GO_QR_NOT_AVAILABLE", "Não foi possível gerar o QR Code agora.", 502, dRef);
        }
        finalQr = extractQrBase64(connRes.data);
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
      code: "EVO_GO_BAD_REQUEST",
      message: "Ocorreu um erro interno ao processar a requisição.",
      debug_ref: dRef
    });

  }
});
