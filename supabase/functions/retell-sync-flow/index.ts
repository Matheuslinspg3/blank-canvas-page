import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get retell config for agent_id and conversation_flow_id
    const { data: config } = await serviceClient
      .from("retell_agent_config")
      .select("agent_id")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (!config?.agent_id) {
      return new Response(JSON.stringify({ error: "Agent ID não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get flow steps from database
    const { data: steps, error: stepsErr } = await serviceClient
      .from("retell_flow_steps")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("position", { ascending: true });

    if (stepsErr || !steps?.length) {
      return new Response(JSON.stringify({ error: "Nenhuma etapa do flow encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert steps to Retell conversation flow nodes format
    const nodes = steps
      .filter((s: any) => !s.is_global)
      .map((step: any) => {
        const node: Record<string, unknown> = {
          id: step.node_id,
          type: step.node_type === "end_call" ? "end_call" : "conversation",
        };

        if (step.node_type !== "end_call") {
          node.instruction = {
            type: "prompt",
            text: step.instruction_text,
          };
        }

        // Convert edges
        if (step.edges && Array.isArray(step.edges) && step.edges.length > 0) {
          node.edges = step.edges.map((edge: any, idx: number) => ({
            id: `edge_${step.node_id}_${idx}`,
            destination_node_id: edge.destination_node_id,
            transition_condition: {
              type: "prompt",
              prompt: edge.condition,
            },
          }));
        }

        return node;
      });

    // Find global node for global_prompt
    const globalStep = steps.find((s: any) => s.is_global);
    const globalPrompt = globalStep?.instruction_text || null;

    // Find start node (first non-global step)
    const startNodeId = nodes[0]?.id || "start";

    const retellApiKey = Deno.env.get("RETELL_API_KEY");
    if (!retellApiKey) {
      return new Response(JSON.stringify({ error: "RETELL_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First, get current agent to find conversation_flow_id
    const agentResponse = await fetch(`https://api.retellai.com/v2/get-agent/${config.agent_id}`, {
      headers: { Authorization: `Bearer ${retellApiKey}` },
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text();
      return new Response(JSON.stringify({ error: "Erro ao buscar agente", details: errText }), {
        status: agentResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentData = await agentResponse.json();
    const conversationFlowId = agentData.response_engine?.llm_id;

    if (!conversationFlowId) {
      return new Response(JSON.stringify({ error: "Conversation Flow ID não encontrado no agente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the conversation flow via Retell API
    const flowPayload: Record<string, unknown> = {
      nodes,
      start_node_id: startNodeId,
    };

    if (globalPrompt) {
      flowPayload.global_prompt = globalPrompt;
    }

    const updateResponse = await fetch(
      `https://api.retellai.com/v2/update-conversation-flow/${conversationFlowId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${retellApiKey}`,
        },
        body: JSON.stringify(flowPayload),
      }
    );

    if (!updateResponse.ok) {
      const errText = await updateResponse.text();
      console.error("Retell flow update error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao atualizar flow na Retell", details: errText }), {
        status: updateResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await updateResponse.json();

    return new Response(JSON.stringify({
      success: true,
      conversation_flow_id: conversationFlowId,
      nodes_count: nodes.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retell-sync-flow error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
