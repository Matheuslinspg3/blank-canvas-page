import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

// ── Welcome helpers ──

function getTimePeriod(): string {
  const hour = new Date().getUTCHours() - 3; // BRT = UTC-3
  const h = hour < 0 ? hour + 24 : hour;
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

function weightedRandomSelect(messages: any[]): any {
  if (Math.random() < 0.2 || messages.every((m: any) => (m.reply_rate ?? 0) === 0)) {
    return messages[Math.floor(Math.random() * messages.length)];
  }
  const totalRate = messages.reduce((sum: number, m: any) => sum + Math.max(m.reply_rate ?? 0, 0.1), 0);
  let rand = Math.random() * totalRate;
  for (const m of messages) {
    rand -= Math.max(m.reply_rate ?? 0, 0.1);
    if (rand <= 0) return m;
  }
  return messages[messages.length - 1];
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const requestSecret = req.headers.get("X-Webhook-Secret");
    const authHeader = req.headers.get("Authorization") || "";
    const hasWebhookAuth = WEBHOOK_SECRET && requestSecret === WEBHOOK_SECRET;

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let { organization_id, instance_name, phone, contact_name, is_lead, campaign_tag } = body as any;

    // Hybrid auth: webhook secret OR authenticated user (preview from UI)
    if (!hasWebhookAuth) {
      if (!authHeader.startsWith("Bearer ")) {
        console.log("[whatsapp-agent-config] Missing Bearer token");
        return new Response(JSON.stringify({ error: "Unauthorized: missing token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createUserClient(authHeader);
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        console.log("[whatsapp-agent-config] getUser failed:", userErr?.message);
        return new Response(JSON.stringify({ error: "Unauthorized: invalid token", detail: userErr?.message }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Resolve org via service client (bypass RLS reliably)
      const svc = createServiceClient();
      const { data: profile } = await svc
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!profile?.organization_id) {
        return new Response(JSON.stringify({ error: "No organization for user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Force org isolation - user can only preview their own org
      organization_id = profile.organization_id;
      instance_name = null;
    }

    if (!organization_id && !instance_name) {
      return new Response(JSON.stringify({ error: "organization_id ou instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    let config: any = null;
    const normalizedInstanceName = typeof instance_name === "string" ? instance_name.trim() : "";

    if (organization_id) {
      const { data } = await sb
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", organization_id)
        .maybeSingle();
      config = data;
    } else if (normalizedInstanceName) {
      const { data } = await sb
        .from("whatsapp_agent_config")
        .select("*")
        .eq("instance_name", normalizedInstanceName)
        .maybeSingle();
      config = data;

      if (!config) {
        let connectionOrgId: string | null = null;
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedInstanceName);

        const { data: byInstanceName } = await sb
          .from("whatsapp_connections")
          .select("organization_id")
          .eq("instance_name", normalizedInstanceName)
          .maybeSingle();
        connectionOrgId = byInstanceName?.organization_id ?? null;

        if (!connectionOrgId) {
          const { data: byProviderInstanceId } = await sb
            .from("whatsapp_connections")
            .select("organization_id")
            .eq("provider_instance_id", normalizedInstanceName)
            .maybeSingle();
          connectionOrgId = byProviderInstanceId?.organization_id ?? null;
        }

        if (!connectionOrgId && uuidLike) {
          const { data: byConnectionId } = await sb
            .from("whatsapp_connections")
            .select("organization_id")
            .eq("id", normalizedInstanceName)
            .maybeSingle();
          connectionOrgId = byConnectionId?.organization_id ?? null;
        }

        const resolvedOrgId = connectionOrgId ?? (uuidLike ? normalizedInstanceName : null);
        if (resolvedOrgId) {
          const { data: orgConfig } = await sb
            .from("whatsapp_agent_config")
            .select("*")
            .eq("organization_id", resolvedOrgId)
            .maybeSingle();
          config = orgConfig;
        }
      }
    }

    if (!config) {
      return new Response(JSON.stringify({ error: "Configuração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = config.organization_id;

    // ── Prompt composition (existing logic) ──

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

    const { data: propertyTypes = [] } = await sb
      .from("property_types")
      .select("id, name")
      .or(`organization_id.eq.${orgId},is_default.eq.true`);

    const propertyTypeMap: Record<string, string> = {};
    (propertyTypes as any[]).forEach((pt: any) => {
      propertyTypeMap[pt.id] = pt.name;
    });

    // Deduplicate: only list unique type names for the prompt
    const uniqueTypeNames = [...new Set(Object.values(propertyTypeMap))];
    const propertyTypesPrompt = uniqueTypeNames.length
      ? `Tipos de imóvel disponíveis: ${uniqueTypeNames.join(", ")}`
      : "Não há tipos de imóvel disponíveis.";

    // Fetch org name for identity block
    const { data: orgData } = await sb
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    const orgName = orgData?.name ?? "a imobiliária";

    const composed_system_prompt = [
      `--- Identidade ---`,
      `Você é ${config.agent_name ?? "a assistente virtual"}, assistente virtual da imobiliária ${orgName}.`,
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

    // ── Properties + neighborhoods (existing logic) ──

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

      (props as any[]).sort((a, b) => (a.featured ? 0 : 1) - (b.featured ? 0 : 1));

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

    // ── AI provider config (existing logic) ──

    const aiConfig: Record<string, unknown> = {
      provider: config.ai_provider ?? "openai",
      model: config.ai_model ?? "gpt-4o",
      mode: config.ai_mode ?? "platform",
    };

    if (config.ai_mode === "byok" && config.byok_api_key) {
      aiConfig.api_key = config.byok_api_key;
    }

    // ── NEW: Credits check ──

    let credits: Record<string, unknown> = { has_credits: false, balance_brl: 0, friendly_message: "Sem carteira de créditos configurada." };

    const { data: wallet } = await sb
      .from("automation_credit_wallets")
      .select("balance_brl")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (wallet) {
      const bal = wallet.balance_brl ?? 0;
      credits = {
        has_credits: bal > 0,
        balance_brl: bal,
        friendly_message: bal > 0 ? null : "Seus créditos de automação acabaram. Recarregue para continuar usando o agente IA.",
      };
    }

    // ── NEW: Welcome message selection ──

    let welcome: Record<string, unknown> = { message: null, message_id: null, media_url: null, media_type: null, delay_seconds: 0, reason: "not_requested" };

    // Only run welcome logic if phone is provided (indicates new conversation context)
    if (phone !== undefined) {
      const cleanPhone = phone ? phone.replace("@s.whatsapp.net", "") : null;

      // Anti-spam check via welcome_log
      let skipWelcome = false;
      let skipReason: string | null = null;

      if (cleanPhone) {
        const { data: lastWelcome } = await sb
          .from("whatsapp_welcome_log")
          .select("*")
          .eq("organization_id", orgId)
          .eq("phone", cleanPhone)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastWelcome) {
          if (lastWelcome.had_dialogue) {
            const daysSinceActivity = lastWelcome.last_activity_at
              ? (Date.now() - new Date(lastWelcome.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
              : 999;
            if (daysSinceActivity < 30) {
              skipWelcome = true;
              skipReason = "returning_contact_with_dialogue";
            }
          }
          if (!skipWelcome) {
            const hoursSinceSent = (Date.now() - new Date(lastWelcome.sent_at).getTime()) / (1000 * 60 * 60);
            if (hoursSinceSent < 24) {
              skipWelcome = true;
              skipReason = "recent_welcome_no_spam";
            }
          }
        }
      }

      if (skipWelcome) {
        welcome = { message: null, message_id: null, media_url: null, media_type: null, delay_seconds: 0, reason: skipReason };
      } else {
        const abTest = config.welcome_ab_test ?? false;
        const delayMin = config.welcome_delay_min ?? 3;
        const delayMax = config.welcome_delay_max ?? 8;

        const { data: allMessages } = await sb
          .from("whatsapp_welcome_messages")
          .select("id, message, position, usage_count, time_period, media_url, media_type, target_audience, campaign_tag, reply_count, reply_rate")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("position", { ascending: true });

        if (!allMessages || allMessages.length === 0) {
          welcome = { message: null, message_id: null, media_url: null, media_type: null, delay_seconds: 0, reason: "no_messages" };
        } else {
          // Filter by time period
          const currentPeriod = getTimePeriod();
          let filtered = allMessages.filter(
            (m: any) => !m.time_period || m.time_period === "all" || m.time_period === currentPeriod
          );

          // Filter by target audience
          if (is_lead === true) {
            filtered = filtered.filter((m: any) => !m.target_audience || m.target_audience === "all" || m.target_audience === "leads_only");
          } else if (is_lead === false) {
            filtered = filtered.filter((m: any) => !m.target_audience || m.target_audience === "all" || m.target_audience === "new_only");
          }

          // Filter/prioritize by campaign tag
          if (campaign_tag) {
            const campaignMatches = filtered.filter((m: any) => m.campaign_tag === campaign_tag);
            if (campaignMatches.length > 0) {
              filtered = campaignMatches;
            }
          }

          if (filtered.length === 0) {
            filtered = allMessages;
          }

          // Select message: A/B weighted or round-robin
          let selected: any;
          if (abTest) {
            selected = weightedRandomSelect(filtered);
          } else {
            const currentIndex = config.welcome_next_index ?? 0;
            const selectedIndex = currentIndex % filtered.length;
            selected = filtered[selectedIndex];
          }

          // Replace {{nome}}
          let finalMessage = selected.message;
          if (contact_name) {
            finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, contact_name);
          } else {
            finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, "").replace(/\s{2,}/g, " ").trim();
          }

          const delaySeconds = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

          // Update index, usage count, and log
          const nextIndex = ((config.welcome_next_index ?? 0) + 1) % allMessages.length;

          await Promise.all([
            sb.from("whatsapp_agent_config").update({ welcome_next_index: nextIndex }).eq("organization_id", orgId),
            sb.from("whatsapp_welcome_messages").update({ usage_count: selected.usage_count + 1 }).eq("id", selected.id),
            ...(cleanPhone
              ? [sb.from("whatsapp_welcome_log").insert({ organization_id: orgId, phone: cleanPhone, welcome_message_id: selected.id })]
              : []),
          ]);

          welcome = {
            message: finalMessage,
            message_id: selected.id,
            media_url: selected.media_url || null,
            media_type: selected.media_type || null,
            delay_seconds: delaySeconds,
            reason: null,
          };
        }
      }
    }

    // ── Build final response ──

    const voiceId = config.voice_id ?? "EXAVITQu4vr4xnSDxMaL";

    return new Response(JSON.stringify({
      // Top-level fields consumed directly by N8N IDENTIDADE node
      instance_name: config.instance_name,
      organization_id: orgId,
      voice_id: voiceId,
      agent_config: {
        organization_id: orgId,
        instance_name: config.instance_name,
        agent_name: config.agent_name,
        tone: config.tone,
        welcome_message: config.welcome_message ?? welcome?.message ?? "",
        away_message: config.away_message,
        working_hours_start: config.working_hours_start,
        working_hours_end: config.working_hours_end,
        transfer_keywords: config.transfer_keywords,
        max_messages_before_transfer: config.max_messages_before_transfer,
        broker_assignment_mode: config.broker_assignment_mode,
        transfer_phone: config.transfer_phone,
        transfer_message: config.transfer_message,
        crm_new_lead_stage_id: config.crm_new_lead_stage_id ?? null,
        crm_qualified_stage_id: config.crm_qualified_stage_id ?? null,
        crm_auto_advance_on_qualified: config.crm_auto_advance_on_qualified ?? true,
      },
      ai_config: aiConfig,
      voice_config: {
        enabled: !!config.voice_enabled,
        percentage: config.voice_percentage ?? 0,
        voice_id: voiceId,
        tts_endpoint: `${Deno.env.get("SUPABASE_URL")}/functions/v1/elevenlabs-tts`,
      },
      composed_system_prompt,
      neighborhoods,
      properties: {
        enabled: !!config.is_property_db_enabled,
        items: properties,
        total: properties.length,
      },
      credits,
      welcome,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-agent-config error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
