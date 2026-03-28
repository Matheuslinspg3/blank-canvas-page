import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

/**
 * Unified endpoint called by the single N8N webhook.
 * Receives { instance_name } and returns ALL config for that org:
 * - agent config (personality, hours, prompts)
 * - property rules & available properties
 * - org info
 */

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const requestSecret = req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { instance_name } = body;

    if (!instance_name) {
      return new Response(JSON.stringify({ error: "instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // 1. Resolve instance_name → organization_id
    const { data: instance } = await sb
      .from("whatsapp_instances")
      .select("organization_id, instance_name, status, phone_number")
      .eq("instance_name", instance_name)
      .maybeSingle();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = instance.organization_id;

    // 2. Fetch org info
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

    // 3. Fetch agent config
    const { data: agentConfig } = await sb
      .from("whatsapp_agent_config")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    const config = agentConfig ?? {
      agent_name: "Valentina",
      tone: "informal",
      system_prompt: "",
      is_property_db_enabled: false,
      auto_qualify_leads: false,
      auto_create_leads: false,
      schedule_visits: false,
      working_hours_start: "08:00",
      working_hours_end: "18:00",
      welcome_message: "Olá! Sou a Valentina, assistente virtual. Como posso ajudar?",
      away_message: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
      transfer_keywords: ["falar com corretor", "atendente", "humano", "reclamação"],
      max_messages_before_transfer: 10,
      broker_assignment_mode: "manual",
      scheduling_days: ["seg", "ter", "qua", "qui", "sex"],
      scheduling_hour_start: "09:00",
      scheduling_hour_end: "17:00",
    };

    // Build composed system prompt
    const dayLabels: Record<string, string> = {
      seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
      sex: "Sexta", sab: "Sábado", dom: "Domingo",
    };

    const promptParts: string[] = [];
    if (config.system_prompt?.trim()) {
      promptParts.push(config.system_prompt.trim());
    }

    const rules: string[] = [];
    if (config.auto_qualify_leads) {
      rules.push("Ao iniciar uma conversa, colete nome completo, telefone, e-mail e interesse do cliente de forma natural.");
    }
    if (config.auto_create_leads) {
      rules.push("Após coletar os dados do cliente, registre automaticamente como lead no CRM.");
    }
    if (config.schedule_visits) {
      const days = (config.scheduling_days ?? []).map((d: string) => dayLabels[d] ?? d).join(", ");
      const hStart = config.scheduling_hour_start ?? "09:00";
      const hEnd = config.scheduling_hour_end ?? "17:00";
      rules.push(`Você pode agendar visitas. Horários disponíveis: ${days} das ${hStart} às ${hEnd}. Confirme data e horário com o cliente antes de registrar.`);
    }
    if (config.is_property_db_enabled) {
      rules.push("Você tem acesso ao banco de imóveis da imobiliária. Use-o para recomendar imóveis relevantes com base nas preferências do cliente.");
    }

    if (rules.length > 0) {
      promptParts.push("\n--- Regras Ativas ---");
      rules.forEach((r) => promptParts.push(`• ${r}`));
    }

    const composed_system_prompt = promptParts.join("\n");

    // 4. Fetch properties if enabled
    let properties: any[] = [];
    if (config.is_property_db_enabled) {
      const { data: rules = [] } = await sb
        .from("whatsapp_property_rules")
        .select("property_id, rule_type")
        .eq("organization_id", orgId);

      const blacklistIds = new Set(rules.filter((r: any) => r.rule_type === "blacklist").map((r: any) => r.property_id));
      const whitelistIds = new Set(rules.filter((r: any) => r.rule_type === "whitelist").map((r: any) => r.property_id));
      const highlightIds = new Set(rules.filter((r: any) => r.rule_type === "highlight").map((r: any) => r.property_id));

      const { data: props = [] } = await sb
        .from("properties")
        .select("id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id")
        .eq("organization_id", orgId)
        .eq("status", "disponivel")
        .limit(50);

      let filtered = (props as any[]).filter((p) => !blacklistIds.has(p.id));
      if (whitelistIds.size > 0) {
        filtered = filtered.filter((p) => whitelistIds.has(p.id));
      }

      filtered.sort((a, b) => {
        const aH = highlightIds.has(a.id) ? 0 : 1;
        const bH = highlightIds.has(b.id) ? 0 : 1;
        return aH - bH;
      });

      properties = filtered.map((p) => ({
        ...p,
        is_highlighted: highlightIds.has(p.id),
      }));
    }

    // 5. Return unified response
    return new Response(JSON.stringify({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
      instance: {
        instance_name: instance.instance_name,
        status: instance.status,
        phone_number: instance.phone_number,
      },
      agent_config: config,
      properties: {
        enabled: !!config.is_property_db_enabled,
        items: properties,
        total: properties.length,
      },
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
