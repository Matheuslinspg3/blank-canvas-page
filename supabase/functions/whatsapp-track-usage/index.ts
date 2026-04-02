/**
 * whatsapp-track-usage — Endpoint para N8N reportar uso de tokens de IA
 * quando chamadas são feitas diretamente a LLMs (sem o ai-router).
 *
 * Auth: X-Webhook-Secret header (WHATSAPP_AGENT_SECRET)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    // Auth via shared secret
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      instance_name,
      provider,
      model,
      input_tokens,
      output_tokens,
      remote_jid,
      function_name,
      success = true,
      error_message,
      metadata,
    } = body;

    // Validate required fields
    if (!instance_name || !provider || !model) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: instance_name, provider, model" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve organization_id from instance_name
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .maybeSingle();

    const organizationId = instance?.organization_id || null;

    // Track billing
    await trackAiBilling(supabase, {
      userId: "system",
      organizationId,
      provider,
      model,
      functionName: function_name || "whatsapp-agent/direct",
      inputTokens: input_tokens || 0,
      outputTokens: output_tokens || 0,
      success: success !== false,
      errorMessage: error_message || null,
      usageType: "text",
      metadata: {
        source: "n8n",
        instance_name,
        remote_jid: remote_jid || null,
        ...(metadata || {}),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: organizationId,
        tracked: true,
        latency_ms: Date.now() - startMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-track-usage] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
