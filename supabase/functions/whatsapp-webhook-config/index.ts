/**
 * whatsapp-webhook-config — Phase 2 Hardened
 *
 * Dual-mode authentication:
 *  1. NEW: HMAC signature (X-Webhook-Signature + X-Webhook-Timestamp + X-Webhook-Nonce)
 *  2. LEGACY: X-Webhook-Secret shared secret (Phase 0)
 *
 * When SEC_ENFORCE_WEBHOOK_HMAC is in 'enforce' mode, legacy is rejected.
 * In 'dual' mode, both are accepted with logging for adoption metrics.
 * In 'observe' mode, everything is accepted but violations are logged.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";
import { getFlag } from "../_shared/security-flags.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET") || "";
const WEBHOOK_SIGNING_KEY = Deno.env.get("WEBHOOK_SIGNING_KEY") || "";

// ── HMAC helpers ──
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

const NONCE_CACHE = new Set<string>();
const NONCE_MAX = 5000;
const REPLAY_WINDOW = 300; // 5 min

type AuthMethod = "hmac" | "legacy" | "none";

async function verifyRequest(req: Request, bodyText: string): Promise<{ valid: boolean; method: AuthMethod; error?: string }> {
  const signature = req.headers.get("X-Webhook-Signature");
  const timestamp = req.headers.get("X-Webhook-Timestamp");
  const nonce = req.headers.get("X-Webhook-Nonce");

  // Try HMAC first
  if (signature && timestamp && WEBHOOK_SIGNING_KEY) {
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW) {
      return { valid: false, method: "hmac", error: "Timestamp outside replay window" };
    }

    // Nonce replay check
    if (nonce) {
      if (NONCE_CACHE.has(nonce)) {
        return { valid: false, method: "hmac", error: "Nonce replay detected" };
      }
    }

    const signedData = `${timestamp}.${nonce || ""}.${bodyText}`;
    const expected = await hmacSha256(WEBHOOK_SIGNING_KEY, signedData);
    if (!timingSafeEqual(signature, expected)) {
      return { valid: false, method: "hmac", error: "Invalid HMAC signature" };
    }

    // Store nonce
    if (nonce) {
      if (NONCE_CACHE.size >= NONCE_MAX) {
        const first = NONCE_CACHE.values().next().value;
        if (first) NONCE_CACHE.delete(first);
      }
      NONCE_CACHE.add(nonce);
    }

    return { valid: true, method: "hmac" };
  }

  // Legacy: X-Webhook-Secret
  const requestSecret = req.headers.get("X-Webhook-Secret");
  if (requestSecret && WEBHOOK_SECRET && requestSecret === WEBHOOK_SECRET) {
    return { valid: true, method: "legacy" };
  }

  return { valid: false, method: "none", error: "No valid authentication" };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const reqMeta = extractRequestMeta(req);

  try {
    const bodyText = await req.text();
    const authResult = await verifyRequest(req, bodyText);
    const flag = await getFlag("SEC_ENFORCE_WEBHOOK_HMAC");

    // Log auth method for adoption metrics
    if (authResult.valid && authResult.method === "legacy") {
      console.log("[whatsapp-webhook-config] Legacy auth used — migration pending");
    }

    if (!authResult.valid) {
      await auditLog({
        event_type: "webhook_auth_deny",
        severity: "error",
        endpoint: "whatsapp-webhook-config",
        actor_type: "webhook",
        decision: "deny",
        reason_code: authResult.error || "auth_failed",
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In enforce mode, reject legacy auth
    if (flag.enabled && flag.mode === "enforce" && authResult.method === "legacy") {
      await auditLog({
        event_type: "webhook_legacy_rejected",
        severity: "warn",
        endpoint: "whatsapp-webhook-config",
        actor_type: "webhook",
        decision: "deny",
        reason_code: "legacy_auth_enforced_off",
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });
      return new Response(JSON.stringify({ error: "Legacy authentication no longer accepted. Use HMAC signing." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In dual mode, log legacy usage for tracking
    if (flag.enabled && flag.mode === "dual" && authResult.method === "legacy") {
      console.warn("[whatsapp-webhook-config] DUAL MODE: Legacy auth accepted but should migrate to HMAC");
    }

    const body = JSON.parse(bodyText);
    const { instance_name } = body;

    if (!instance_name) {
      return new Response(JSON.stringify({ error: "instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("*")
      .eq("instance_name", instance_name)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = config.organization_id;

    const { data: org } = await sb
      .from("organizations")
      .select("id, name, slug")
      .eq("id", orgId)
      .maybeSingle();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt variables
    const dayLabels: Record<string, string> = {
      seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
      sex: "Sexta", sab: "Sábado", dom: "Domingo",
    };

    const prompt_qualify = config.auto_qualify_leads
      ? "Ao iniciar uma conversa, colete nome completo, telefone, e-mail e interesse do cliente de forma natural."
      : "Não é necessário a coleta de dados como nome completo, telefone, e-mail e interesse do cliente.";

    const prompt_create_lead = config.auto_create_leads
      ? "Após coletar os dados do cliente, registre automaticamente como lead no CRM."
      : "Não registre leads automaticamente no CRM. Apenas converse normalmente.";

    const prompt_schedule = config.schedule_visits
      ? (() => {
          const days = (config.scheduling_days ?? []).map((d: string) => dayLabels[d] ?? d).join(", ");
          const hStart = config.scheduling_hour_start ?? "09:00";
          const hEnd = config.scheduling_hour_end ?? "17:00";
          return `Você pode agendar visitas. Horários disponíveis: ${days} das ${hStart} às ${hEnd}. Confirme data e horário com o cliente antes de registrar.`;
        })()
      : "Não ofereça ou agende visitas a imóveis. Caso o cliente solicite, oriente-o a entrar em contato diretamente com a imobiliária.";

    const prompt_properties = config.is_property_db_enabled
      ? "Você tem acesso ao banco de imóveis da imobiliária. Use-o para recomendar imóveis relevantes com base nas preferências do cliente."
      : "Você não tem acesso ao banco de imóveis. Caso o cliente pergunte sobre imóveis específicos, oriente-o a consultar o site ou falar com um corretor.";

    // Fetch property types
    const { data: propertyTypes = [] } = await sb
      .from("property_types")
      .select("id, name")
      .or(`organization_id.eq.${orgId},is_default.eq.true`);

    const propertyTypeMap: Record<string, string> = {};
    (propertyTypes as any[]).forEach((pt: any) => {
      propertyTypeMap[pt.id] = pt.name;
    });

    const propertyTypesPrompt = Object.entries(propertyTypeMap).length
      ? `Use o seguinte mapeamento de tipos de imóvel (ID => Nome):\n${Object.entries(propertyTypeMap)
          .map(([id, name]) => `- ${id}: ${name}`)
          .join("\n")}`
      : "Não há mapeamento de tipos de imóvel disponível para esta organização.";

    const composed_system_prompt = [
      `--- Identidade ---`,
      `Você é ${config.agent_name ?? "a assistente virtual"}, assistente virtual da imobiliária ${org.name}.`,
      `Tom de comunicação: ${config.tone ?? "profissional e amigável"}.`,
      ``,
      `--- Personalidade e contexto (definido pela imobiliária) ---`,
      config.system_prompt?.trim() ?? "",
      ``,
      `--- Ferramentas disponíveis ---`,
      `• BUSCA DE IMÓVEIS: Use a ferramenta de busca de propriedades para encontrar imóveis com base nos filtros do cliente (bairro, preço, quartos, tipo).`,
      `• ENVIO DE FOTOS: Quando apresentar imóveis ao cliente, SEMPRE use a ferramenta de envio de fotos (whatsapp-send-property-photos) informando os property_ids dos imóveis mencionados. Isso envia a foto de capa automaticamente.`,
      `• CRIAÇÃO DE LEAD: Use a ferramenta de lead para registrar o contato no CRM quando apropriado.`,
      `• TRANSBORDO: Use a ferramenta de transferência para encaminhar a conversa a um corretor humano quando necessário.`,
      ``,
      `--- Regras de apresentação de imóveis ---`,
      `• Ao recomendar imóveis, apresente de forma resumida: título, tipo do imóvel, bairro/cidade, preço e metragem.`,
      `• OBRIGATÓRIO: Após listar imóveis na mensagem, chame a ferramenta de envio de fotos com os property_ids para que o cliente receba as imagens.`,
      `• Não liste mais de 5 imóveis por vez; pergunte se o cliente deseja ver mais opções.`,
      `• Se o cliente demonstrar interesse em um imóvel específico, envie a foto dele novamente e ofereça agendar uma visita (se habilitado).`,
      ``,
      `--- Instruções operacionais ---`,
      `• ${prompt_qualify}`,
      `• ${prompt_create_lead}`,
      `• ${prompt_schedule}`,
      `• ${prompt_properties}`,
      `• ${propertyTypesPrompt}`,
    ].filter(Boolean).join("\n");

    // Fetch properties if enabled
    let properties: any[] = [];
    const neighborhoods: Record<string, string[]> = {};

    if (config.is_property_db_enabled) {
      const { data: props = [] } = await sb
        .from("properties")
        .select("id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id, featured")
        .eq("organization_id", orgId)
        .eq("status", "disponivel")
        .eq("ai_blacklist", false)
        .limit(50);

      (props as any[]).sort((a, b) => {
        const aF = a.featured ? 0 : 1;
        const bF = b.featured ? 0 : 1;
        return aF - bF;
      });

      properties = (props as any[]).map((p) => ({
        ...p,
        property_type_name: propertyTypeMap[p.property_type_id] ?? null,
      }));

      for (const p of properties) {
        if (p.address_neighborhood) {
          if (!neighborhoods[p.address_neighborhood]) {
            neighborhoods[p.address_neighborhood] = [];
          }
          neighborhoods[p.address_neighborhood].push(p.id);
        }
      }
    }

    return new Response(JSON.stringify({
      organization: { id: org.id, name: org.name, slug: org.slug },
      instance: {
        instance_name: config.instance_name,
        status: config.status,
        phone_number: config.phone_number,
      },
      agent_config: {
        agent_name: config.agent_name,
        tone: config.tone,
        welcome_message: config.welcome_message,
        away_message: config.away_message,
        working_hours_start: config.working_hours_start,
        working_hours_end: config.working_hours_end,
        transfer_keywords: config.transfer_keywords,
        max_messages_before_transfer: config.max_messages_before_transfer,
        broker_assignment_mode: config.broker_assignment_mode,
      },
      composed_system_prompt,
      prompt_variables: {
        qualify: prompt_qualify,
        create_lead: prompt_create_lead,
        schedule: prompt_schedule,
        properties: prompt_properties,
        property_types: propertyTypesPrompt,
      },
      property_types: propertyTypeMap,
      neighborhoods,
      properties: {
        enabled: !!config.is_property_db_enabled,
        items: properties,
        total: properties.length,
      },
      _auth_method: authResult.method, // For observability
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-webhook-config error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
