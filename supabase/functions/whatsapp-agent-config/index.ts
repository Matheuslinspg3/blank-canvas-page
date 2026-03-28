import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Validate X-Webhook-Secret header
    const requestSecret = req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organization_id, instance_name } = body;

    if (!organization_id && !instance_name) {
      return new Response(JSON.stringify({ error: "organization_id ou instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // Resolve org ID from instance_name if needed
    let resolvedOrgId = organization_id;
    if (!resolvedOrgId && instance_name) {
      const { data: inst } = await sb
        .from("whatsapp_instances")
        .select("organization_id")
        .eq("instance_name", instance_name)
        .maybeSingle();
      if (!inst) {
        return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedOrgId = inst.organization_id;
    }

    // Validate organization exists
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("id", resolvedOrgId)
      .maybeSingle();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organization_id_resolved = resolvedOrgId;

    const { data: config, error } = await sb
      .from("whatsapp_agent_config")
      .select("*")
      .eq("organization_id", organization_id_resolved)
      .maybeSingle();

    if (error) throw error;

    const baseConfig = config ?? {
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

    const dayLabels: Record<string, string> = {
      seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
      sex: "Sexta", sab: "Sábado", dom: "Domingo",
    };

    const prompt_qualify = baseConfig.auto_qualify_leads
      ? "Ao iniciar uma conversa, colete nome completo, telefone, e-mail e interesse do cliente de forma natural."
      : "Não é necessário a coleta de dados como nome completo, telefone, e-mail e interesse do cliente.";

    const prompt_create_lead = baseConfig.auto_create_leads
      ? "Após coletar os dados do cliente, registre automaticamente como lead no CRM."
      : "Não registre leads automaticamente no CRM. Apenas converse normalmente.";

    const prompt_schedule = baseConfig.schedule_visits
      ? (() => {
          const days = (baseConfig.scheduling_days ?? []).map((d: string) => dayLabels[d] ?? d).join(", ");
          const hStart = baseConfig.scheduling_hour_start ?? "09:00";
          const hEnd = baseConfig.scheduling_hour_end ?? "17:00";
          return `Você pode agendar visitas. Horários disponíveis: ${days} das ${hStart} às ${hEnd}. Confirme data e horário com o cliente antes de registrar.`;
        })()
      : "Não ofereça ou agende visitas a imóveis. Caso o cliente solicite, oriente-o a entrar em contato diretamente com a imobiliária.";

    const prompt_properties = baseConfig.is_property_db_enabled
      ? "Você tem acesso ao banco de imóveis da imobiliária. Use-o para recomendar imóveis relevantes com base nas preferências do cliente."
      : "Você não tem acesso ao banco de imóveis. Caso o cliente pergunte sobre imóveis específicos, oriente-o a consultar o site ou falar com um corretor.";

    const composed_system_prompt = [
      baseConfig.system_prompt?.trim() ?? "",
      "\n--- Instruções ---",
      `• ${prompt_qualify}`,
      `• ${prompt_create_lead}`,
      `• ${prompt_schedule}`,
      `• ${prompt_properties}`,
    ].filter(Boolean).join("\n");

    const response = {
      ...baseConfig,
      is_property_db_enabled: prompt_properties,
      auto_qualify_leads: prompt_qualify,
      auto_create_leads: prompt_create_lead,
      schedule_visits: prompt_schedule,
      composed_system_prompt,
      prompt_variables: {
        qualify: prompt_qualify,
        create_lead: prompt_create_lead,
        schedule: prompt_schedule,
        properties: prompt_properties,
      },
    };

    return new Response(JSON.stringify(response), {
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
