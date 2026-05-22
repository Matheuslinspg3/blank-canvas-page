import { createServiceClient, getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://n8n.costazul.shop/webhook/WEBHOOK-WA-AGENT-PORT";

type PublicErrorCode =
  | "MISSING_EVOLUTION_CONFIG"
  | "UNAUTHORIZED"
  | "ORGANIZATION_NOT_FOUND"
  | "INVALID_PHONE_NUMBER"
  | "EVOLUTION_CREATE_FAILED"
  | "EVOLUTION_CONNECT_FAILED"
  | "EVOLUTION_QR_NOT_AVAILABLE"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

class PublicHttpError extends Error {
  status: number;
  code: PublicErrorCode;
  details?: Record<string, unknown>;

  constructor(status: number, code: PublicErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PublicHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const successResponse = (body: Record<string, unknown>, status = 200) =>
  jsonResponse({ success: true, ...body }, status);

const errorResponse = (error: PublicHttpError) =>
  jsonResponse({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  }, error.status);

const safePreview = (raw: string, max = 500) =>
  raw
    .replace(/apikey\s*[:=]\s*["']?[^,"'\s]+/gi, "apikey:[redacted]")
    .replace(/token\s*[:=]\s*["']?[^,"'\s]+/gi, "token:[redacted]")
    .substring(0, max);

const captureWhatsAppException = async (error: unknown, context: Record<string, unknown> = {}) => {
  try {
    const dsn = Deno.env.get("SENTRY_DSN");
    if (!dsn) return;
    const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const now = new Date().toISOString();
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: now,
      level: "error",
      platform: "javascript",
      environment: Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "unknown",
      server_name: "supabase-edge",
      tags: {
        source: "whatsapp",
        ...((context.tags as Record<string, string> | undefined) ?? {}),
      },
      extra: {
        ...context,
      },
      exception: {
        values: [{
          type: error instanceof Error ? error.name : "Error",
          value: message,
        }],
      },
    };

    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!projectId) return;
    const key = url.username;
    const host = `${url.protocol}//${url.host}`;
    const sentryUrl = `${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${encodeURIComponent(key)}`;
    await fetch(sentryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // never break flow because of observability
  }
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

const parseJsonSafely = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const classifyEvolutionStatus = (status: number) => {
  if (status === 401 || status === 403) return 401;
  if (status === 404) return 404;
  if (status >= 400 && status < 500) return 422;
  return 502;
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
    payload?.qrcode,
    payload?.qrCode,
    payload?.qr_code,
    payload?.code,
    payload?.data?.base64,
    payload?.data?.qrcode,
    payload?.data?.qrCode,
    payload?.data?.qr_code,
    payload?.qrcode?.base64,
    payload?.qrcode?.code,
    payload?.qrcode?.qrCode,
    payload?.data?.qrcode?.base64,
    payload?.data?.qrcode?.code,
    payload?.data?.qrcode?.qrCode,
    payload?.response?.base64,
    payload?.response?.qrcode,
    payload?.response?.qrCode,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized) continue;
    if (normalized.startsWith("data:image")) return normalized;
    if (normalized.length > 128) return normalized;
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
      const evoState = String(connectData?.instance?.state ?? connectData?.state ?? connectData?.connectionStatus ?? "").toLowerCase();
      const isConnected = evoState === "open" || evoState === "connected";

      bestResult = {
        method: variant.label,
        status: connectRes.status,
        ok: connectRes.ok,
        connectRaw,
        connectData,
        pairingCode,
        qrBase64,
        evoState,
        isConnected,
      };

      if (cleanPhone) {
        if (isConnected || pairingCode) return bestResult;
      } else if (isConnected || qrBase64) {
        return bestResult;
      }
    }

    if (attempt >= retries) return bestResult;

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
      throw new PublicHttpError(
        422,
        "MISSING_EVOLUTION_CONFIG",
        "A integração do WhatsApp não está configurada no servidor. Verifique EVOLUTION_API_URL e EVOLUTION_API_GLOBAL_KEY.",
      );
    }
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      throw new PublicHttpError(401, "UNAUTHORIZED", "Sessão expirada ou usuário não autenticado. Faça login novamente.");
    }

    const sb = createServiceClient();
    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      throw new PublicHttpError(404, "ORGANIZATION_NOT_FOUND", "Não foi possível encontrar a organização do usuário.");
    }

    const orgId = profile?.organization_id;
    if (!orgId) {
      throw new PublicHttpError(404, "ORGANIZATION_NOT_FOUND", "Usuário sem organização vinculada.");
    }

    let phoneNumber: string | null = null;
    try {
      const body = await req.json();
      phoneNumber = body?.phone_number ?? null;
    } catch {
      // no body or invalid json: QR mode
    }

    if (phoneNumber && phoneNumber.replace(/\D/g, "").length < 10) {
      throw new PublicHttpError(422, "INVALID_PHONE_NUMBER", "Informe um número de WhatsApp válido com DDD.");
    }

    const { data: org, error: orgError } = await sb
      .from("organizations")
      .select("id, name, slug")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      throw new PublicHttpError(404, "ORGANIZATION_NOT_FOUND", "Organização não encontrada.");
    }

    const orgSlug = org.slug ||
      org.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase()
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    const { data: existing, error: existingError } = await sb
      .from("whatsapp_agent_config")
      .select("id, instance_name, status, qr_code, phone_number, instance_token")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existingError) {
      throw new PublicHttpError(500, "DATABASE_ERROR", "Não foi possível carregar a configuração do WhatsApp.");
    }

    if (existing?.status === "connected" && existing?.instance_token) {
      await auditLog(sb, orgId, "activate_idempotent", user.id, { reason: "already_connected" });
      return successResponse({
        qrCode: null,
        pairingCode: null,
        connected: true,
        status: "connected",
        instanceCreated: false,
      });
    }

    if (existing?.instance_name && existing?.instance_token) {
      console.log("whatsapp-activate: reconnect existing instance", JSON.stringify({ instanceName: existing.instance_name, orgId }));
      await sb.from("whatsapp_agent_config").update({ status: "connecting" }).eq("id", existing.id);

      const connectResult = await connectEvolutionInstance(
        baseUrl,
        EVOLUTION_API_KEY,
        existing.instance_name,
        phoneNumber,
        phoneNumber ? 2 : 0,
      );

      console.log("whatsapp-activate: reconnect response", JSON.stringify({
        method: connectResult?.method,
        status: connectResult?.status,
        ok: connectResult?.ok,
        state: connectResult?.evoState,
        hasQr: !!connectResult?.qrBase64,
        hasPairingCode: !!connectResult?.pairingCode,
        raw: safePreview(connectResult?.connectRaw ?? ""),
      }));

      if (connectResult?.isConnected || connectResult?.pairingCode || connectResult?.qrBase64) {
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

        return successResponse({
          qrCode: connectResult.qrBase64,
          pairingCode: connectResult.pairingCode,
          connected: connectResult.isConnected,
          status: connectResult.isConnected ? "connected" : "connecting",
          instanceCreated: false,
        });
      }

      if (connectResult?.status && connectResult.status >= 400 && connectResult.status !== 404) {
        throw new PublicHttpError(
          classifyEvolutionStatus(connectResult.status),
          "EVOLUTION_CONNECT_FAILED",
          "A Evolution API recusou a conexão da instância existente. Verifique URL, token e estado da instância.",
          { providerStatus: connectResult.status, method: connectResult.method },
        );
      }
    }

    const instanceName = existing?.instance_name || `${orgSlug}-${org.id}`;
    console.log("whatsapp-activate: target instance", JSON.stringify({ instanceName, orgId, hasExisting: !!existing }));

    if (existing?.id) {
      const { error: updateError } = await sb.from("whatsapp_agent_config").update({
        status: "provisioning",
        instance_name: instanceName,
        qr_code: null,
        instance_token: existing.instance_token ?? null,
      }).eq("id", existing.id);
      if (updateError) throw new PublicHttpError(500, "DATABASE_ERROR", "Não foi possível atualizar a configuração do WhatsApp.");
    } else {
      const { error: insertError } = await sb.from("whatsapp_agent_config").insert({
        organization_id: orgId,
        instance_name: instanceName,
        status: "provisioning",
      });
      if (insertError) throw new PublicHttpError(500, "DATABASE_ERROR", "Não foi possível criar a configuração do WhatsApp.");
    }

    let instanceToken: string | null = existing?.instance_token ?? null;
    let instanceExists = false;

    try {
      const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const fetchRaw = await fetchRes.text();
      if (fetchRes.ok) {
        const fetchData = parseJsonSafely(fetchRaw);
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

          console.log("whatsapp-activate: reusing Evolution instance", JSON.stringify({ instanceName }));

          const webhookRes = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              url: WEBHOOK_URL,
              byEvents: false,
              base64: true,
              events: ["MESSAGES_UPSERT"],
            }),
          });
          if (!webhookRes.ok) {
            const webhookRaw = await webhookRes.text();
            console.warn("whatsapp-activate: webhook set failed", JSON.stringify({ status: webhookRes.status, raw: safePreview(webhookRaw) }));
          }
        }
      } else {
        console.warn("whatsapp-activate: fetchInstances failed", JSON.stringify({ status: fetchRes.status, raw: safePreview(fetchRaw) }));
      }
    } catch (e) {
      console.warn("whatsapp-activate: fetchInstances check failed, will try create", e);
    }

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

      console.log("whatsapp-activate: creating new instance", JSON.stringify({ instanceName }));
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify(createPayload),
      });

      const createRaw = await createRes.text();
      console.log("whatsapp-activate: Evolution create response", JSON.stringify({ status: createRes.status, raw: safePreview(createRaw, 1000) }));

      if (!createRes.ok) {
        const duplicateName = createRes.status === 403 && /already in use|already exists|em uso|já existe/i.test(createRaw);
        if (duplicateName) {
          console.warn("whatsapp-activate: instance name already exists, reusing", JSON.stringify({ instanceName }));
          instanceExists = true;
        } else {
          await captureWhatsAppException(new Error("agent_create_instance_failed"), {
            flow: "agent_whatsapp",
            action: "create_instance",
            status: createRes.status,
            instance_name: instanceName,
            response: safePreview(createRaw),
          });
          throw new PublicHttpError(
            classifyEvolutionStatus(createRes.status),
            "EVOLUTION_CREATE_FAILED",
            "Não foi possível criar a instância na Evolution API. Verifique URL, token e permissões da API.",
            { providerStatus: createRes.status },
          );
        }
      } else {
        const createData = parseJsonSafely(createRaw);
        instanceToken = createData?.hash?.apikey ?? createData?.token ?? createData?.apikey ?? instanceToken;
      }
    }

    const connectResult = await connectEvolutionInstance(
      baseUrl,
      EVOLUTION_API_KEY,
      instanceName,
      phoneNumber,
      phoneNumber ? 2 : 1,
    );

    console.log("whatsapp-activate: Evolution connect response", JSON.stringify({
      method: connectResult?.method,
      status: connectResult?.status,
      ok: connectResult?.ok,
      state: connectResult?.evoState,
      hasQr: !!connectResult?.qrBase64,
      hasPairingCode: !!connectResult?.pairingCode,
      raw: safePreview(connectResult?.connectRaw ?? ""),
    }));

    const pairingCode = connectResult?.pairingCode ?? null;
    const qrBase64 = connectResult?.qrBase64 ?? null;
    const evoState = connectResult?.evoState ?? "";
    const isConnected = connectResult?.isConnected === true;

    if (!isConnected && !pairingCode && !qrBase64) {
      await captureWhatsAppException(new Error("agent_connect_without_qr_or_pairing"), {
        flow: "agent_whatsapp",
        action: "connect_instance",
        instance_name: instanceName,
        provider_status: connectResult?.status,
        response: safePreview(connectResult?.connectRaw ?? ""),
      });

      throw new PublicHttpError(
        connectResult?.status ? classifyEvolutionStatus(connectResult.status) : 502,
        "EVOLUTION_QR_NOT_AVAILABLE",
        phoneNumber
          ? "A Evolution API não retornou o código de pareamento. Aguarde alguns segundos e tente novamente."
          : "A Evolution API não retornou o QR Code. Aguarde alguns segundos e tente novamente.",
        { providerStatus: connectResult?.status, method: connectResult?.method },
      );
    }

    const instanceStatus = isConnected
      ? "connected"
      : ((phoneNumber || qrBase64 || pairingCode) ? "connecting" : "provisioning");

    const { data: currentConfig, error: currentConfigError } = await sb
      .from("whatsapp_agent_config")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (currentConfigError || !currentConfig?.id) {
      throw new PublicHttpError(500, "DATABASE_ERROR", "Não foi possível salvar a configuração do WhatsApp.");
    }

    const updatePayload: Record<string, any> = {
      instance_name: instanceName,
      status: instanceStatus,
      qr_code: qrBase64 ?? null,
    };
    if (instanceToken) updatePayload.instance_token = instanceToken;
    if (phoneNumber) updatePayload.phone_number = phoneNumber.replace(/\D/g, "");

    const { error: saveError } = await sb.from("whatsapp_agent_config").update(updatePayload).eq("id", currentConfig.id);
    if (saveError) {
      throw new PublicHttpError(500, "DATABASE_ERROR", "Não foi possível salvar o QR Code do WhatsApp.");
    }

    await auditLog(sb, orgId, "activate_evo_direct", user.id, {
      instanceName,
      hasToken: !!instanceToken,
      hasQr: !!qrBase64,
      hasPairingCode: !!pairingCode,
      state: evoState,
      isConnected,
      isReconnection: !!existing?.instance_token,
    });

    return successResponse({
      qrCode: qrBase64,
      pairingCode,
      connected: isConnected,
      status: instanceStatus,
      instanceCreated: !instanceExists,
    });
  } catch (err) {
    if (err instanceof PublicHttpError) {
      console.warn("whatsapp-activate: handled error", JSON.stringify({ status: err.status, code: err.code, message: err.message, details: err.details }));
      if (err.status >= 500) {
        await captureWhatsAppException(err, { action: "handled_server_error", flow: "agent_whatsapp", route: "whatsapp-activate-webhook" });
      }
      return errorResponse(err);
    }

    console.error("whatsapp-activate: unexpected error", err);
    await captureWhatsAppException(err, { action: "unexpected", flow: "agent_whatsapp", route: "whatsapp-activate-webhook" });
    return errorResponse(new PublicHttpError(500, "INTERNAL_ERROR", "Erro interno ao ativar o WhatsApp. Tente novamente ou acione o suporte."));
  }
});
