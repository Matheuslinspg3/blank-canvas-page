import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

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

    // 1. Resolve instance_name → config (single query!)
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

    // 3. Build prompt variables from config
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

    // 4. Fetch property types for this org
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
      config.system_prompt?.trim() ?? "",
      "\n--- Instruções ---",
      `• ${prompt_qualify}`,
      `• ${prompt_create_lead}`,
      `• ${prompt_schedule}`,
      `• ${prompt_properties}`,
      `• ${propertyTypesPrompt}`,
    ].filter(Boolean).join("\n");

    // 5. Fetch properties if enabled
    let properties: any[] = [];
    if (config.is_property_db_enabled) {
      const { data: rules = [] } = await sb
        .from("whatsapp_property_rules")
        .select("property_id, rule_type")
        .eq("organization_id", orgId);

      const highlightIds = new Set(rules.filter((r: any) => r.rule_type === "highlight").map((r: any) => r.property_id));

      const { data: props = [] } = await sb
        .from("properties")
        .select("id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id")
        .eq("organization_id", orgId)
        .eq("status", "disponivel")
        .eq("ai_blacklist", false)
        .limit(50);

      (props as any[]).sort((a, b) => {
        const aH = highlightIds.has(a.id) ? 0 : 1;
        const bH = highlightIds.has(b.id) ? 0 : 1;
        return aH - bH;
      });

      properties = (props as any[]).map((p) => ({
        ...p,
        property_type_name: propertyTypeMap[p.property_type_id] ?? null,
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
        instance_name: config.instance_name,
        status: config.status,
        phone_number: config.phone_number,
      },
      agent_config: {
        ...config,
        auto_qualify_leads: prompt_qualify,
        auto_create_leads: prompt_create_lead,
        schedule_visits: prompt_schedule,
        is_property_db_enabled: prompt_properties,
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
