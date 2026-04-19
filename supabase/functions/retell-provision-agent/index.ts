// Provisiona um agente Retell + conversation flow para a organização do usuário.
// Cria flow padrão "Sofia" + agent vinculado, salva IDs em retell_agent_config.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const DEFAULT_VOICE_ID = "11labs-Adrian"; // voz default Retell (PT-BR compatível)
const DEFAULT_LANGUAGE = "pt-BR";

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ scope: "retell.provision", event, ...data }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await service
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotente: se já existe agent_id válido, retorna sucesso
    const { data: existing } = await service
      .from("retell_agent_config")
      .select("id, agent_id, conversation_flow_id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existing?.agent_id && existing?.conversation_flow_id) {
      log("already_provisioned", { org_id: orgId, agent_id: existing.agent_id });
      return new Response(JSON.stringify({
        success: true,
        already_provisioned: true,
        agent_id: existing.agent_id,
        conversation_flow_id: existing.conversation_flow_id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!RETELL_API_KEY) {
      return new Response(JSON.stringify({ error: "RETELL_API_KEY não configurada na plataforma" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("creating_flow", { org_id: orgId });

    // 1) Cria conversation flow padrão (1 nó conversation + 1 end_call)
    const flowPayload = {
      global_prompt: "Você é Sofia, assistente de voz da imobiliária. Tom acolhedor, profissional e consultivo. Trate o cliente pelo nome assim que souber. Nunca invente informações.",
      start_node_id: "start",
      nodes: [
        {
          id: "start",
          type: "conversation",
          instruction: {
            type: "prompt",
            text: "Cumprimente o cliente, apresente-se como Sofia da imobiliária, pergunte o nome e qual o interesse (compra, locação ou investimento). Conduza a conversa de forma natural coletando: tipo de imóvel, região de preferência, faixa de orçamento e prazo. Ao final, confirme os dados e informe que um corretor entrará em contato.",
          },
          edges: [
            {
              id: "edge_start_end",
              destination_node_id: "end",
              transition_condition: {
                type: "prompt",
                prompt: "O cliente confirmou os dados ou pediu para encerrar a chamada.",
              },
            },
          ],
        },
        { id: "end", type: "end_call" },
      ],
    };

    const flowRes = await fetch("https://api.retellai.com/create-conversation-flow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify(flowPayload),
    });

    const flowText = await flowRes.text();
    if (!flowRes.ok) {
      log("flow_create_error", { status: flowRes.status, body: flowText.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Falha ao criar conversation flow", details: flowText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const flowData = JSON.parse(flowText);
    const conversationFlowId = flowData.conversation_flow_id;
    log("flow_created", { conversation_flow_id: conversationFlowId });

    // 2) Cria agent vinculado ao flow
    const agentPayload = {
      response_engine: { type: "conversation-flow", conversation_flow_id: conversationFlowId },
      voice_id: DEFAULT_VOICE_ID,
      language: DEFAULT_LANGUAGE,
      agent_name: "Sofia",
    };

    const agentRes = await fetch("https://api.retellai.com/create-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify(agentPayload),
    });
    const agentText = await agentRes.text();
    if (!agentRes.ok) {
      log("agent_create_error", { status: agentRes.status, body: agentText.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Falha ao criar agent", details: agentText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const agentData = JSON.parse(agentText);
    const agentId = agentData.agent_id;
    log("agent_created", { agent_id: agentId });

    // 3) Persiste no DB (upsert)
    const updates = {
      organization_id: orgId,
      agent_id: agentId,
      conversation_flow_id: conversationFlowId,
      enabled: true,
      auto_outbound_enabled: true,
    };

    if (existing?.id) {
      const { error: updErr } = await service
        .from("retell_agent_config")
        .update(updates)
        .eq("id", existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await service
        .from("retell_agent_config")
        .insert(updates);
      if (insErr) throw insErr;
    }

    log("saved_to_db", { org_id: orgId, agent_id: agentId });

    return new Response(JSON.stringify({
      success: true,
      agent_id: agentId,
      conversation_flow_id: conversationFlowId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    log("internal_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
