
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    const { data: config, error } = await sb
      .from("whatsapp_agent_config")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (error) throw error;

    if (!config) {
      // Return defaults
      return new Response(
        JSON.stringify({
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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(config), {
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
