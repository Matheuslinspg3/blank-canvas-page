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

    // Get user's org
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

    // Get retell config for org
    const { data: config } = await supabase
      .from("retell_agent_config")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    const retellApiKey = Deno.env.get("RETELL_API_KEY");
    const agentId = config?.agent_id || Deno.env.get("RETELL_AGENT_ID");

    if (!retellApiKey || !agentId) {
      return new Response(JSON.stringify({ error: "Retell AI não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse optional metadata from request body
    let metadata: Record<string, unknown> = {};
    try {
      const body = await req.json();
      metadata = body.metadata ?? {};
    } catch {
      // No body is fine
    }

    // Build dynamic metadata with qualification prompt if configured
    const retellMetadata: Record<string, unknown> = {
      ...metadata,
      organization_id: profile.organization_id,
    };

    if (config?.qualification_prompt) {
      retellMetadata.qualification_prompt = config.qualification_prompt;
    }
    if (config?.transfer_keywords?.length) {
      retellMetadata.transfer_keywords = config.transfer_keywords;
    }

    // Create web call via Retell API
    const retellResponse = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retellApiKey}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: retellMetadata,
      }),
    });

    if (!retellResponse.ok) {
      const errText = await retellResponse.text();
      console.error("Retell API error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao criar chamada", details: errText }), {
        status: retellResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callData = await retellResponse.json();

    // Save call record
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient.from("voice_calls").insert({
      organization_id: profile.organization_id,
      call_id: callData.call_id,
      agent_id: agentId,
      call_type: "web_call",
      call_status: "registered",
      metadata: retellMetadata,
      lead_id: metadata.lead_id || null,
      started_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      access_token: callData.access_token,
      call_id: callData.call_id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retell-create-web-call error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
