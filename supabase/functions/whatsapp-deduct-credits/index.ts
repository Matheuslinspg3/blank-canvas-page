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
    const { organization_id, provider, model, tokens_input, tokens_output, raw_cost_usd } = body;

    if (!organization_id || !provider || !model) {
      return new Response(JSON.stringify({ error: "organization_id, provider, model required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // Call the atomic deduction function
    const { data, error } = await sb.rpc("deduct_ai_credits", {
      p_organization_id: organization_id,
      p_provider: provider,
      p_model: model,
      p_tokens_input: tokens_input || 0,
      p_tokens_output: tokens_output || 0,
      p_raw_cost_usd: raw_cost_usd || 0,
    });

    if (error) throw error;

    const result = typeof data === "string" ? JSON.parse(data) : data;

    return new Response(JSON.stringify(result), {
      status: result?.ok ? 200 : 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-deduct-credits error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
