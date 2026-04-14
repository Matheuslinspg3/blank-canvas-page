import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Try by id first, fallback to user_id column
    let profile: any = null;
    const { data: p1 } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    profile = p1;

    if (!profile) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 400, headers: corsHeaders });
    }

    const orgId = profile.organization_id;

    // Get agent config for personality context
    const { data: agentConfig } = await supabase
      .from("whatsapp_agent_config")
      .select("agent_name, system_prompt")
      .eq("organization_id", orgId)
      .single();

    // Get org name for brand context
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const agentName = agentConfig?.agent_name || "Assistente";
    const orgName = org?.name || "nossa empresa";
    const personality = agentConfig?.system_prompt || "";

    const prompt = `Gere exatamente 10 mensagens de boas-vindas curtas e variadas para um assistente virtual de WhatsApp de uma imobiliária.

Contexto:
- Nome do assistente: ${agentName}
- Nome da empresa: ${orgName}
- Personalidade: ${personality ? personality.substring(0, 500) : "Profissional, amigável e prestativo"}

Regras:
- Cada mensagem deve ter no máximo 2 frases
- Varie o tom: algumas mais formais, outras mais descontraídas
- Use {{nome}} como placeholder para o nome do cliente (quando disponível)
- Algumas podem incluir emoji, outras não
- Não repita estruturas
- Retorne APENAS um JSON array de strings, sem markdown, sem explicação

Exemplo de formato:
["Olá! Sou o ${agentName}, da ${orgName}. Como posso ajudar?", "Oi, {{nome}}! 😊 Bem-vindo à ${orgName}!"]`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "chat",
        prompt,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success || !aiResult.text) {
      console.error("ai-router failed:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagens", detail: aiResult.error || "ai-router returned no text", fallback: true }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse AI response - extract JSON array
    let messages: string[];
    try {
      const text = aiResult.text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No array found");
      messages = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(messages) || messages.length === 0) throw new Error("Invalid array");
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), { status: 500, headers: corsHeaders });
    }

    // Delete existing messages for this org before inserting new ones
    await supabase
      .from("whatsapp_welcome_messages")
      .delete()
      .eq("organization_id", orgId);

    // Insert new messages
    const rows = messages.slice(0, 10).map((msg, i) => ({
      organization_id: orgId,
      message: msg,
      position: i,
      is_active: true,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("whatsapp_welcome_messages")
      .insert(rows)
      .select();

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Erro ao salvar mensagens" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ messages: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-generate-welcomes error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
