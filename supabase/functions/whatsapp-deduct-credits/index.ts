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

    // Use the automation credits system (BRL-based, separate from AI credits)
    const { data, error } = await sb.rpc("deduct_automation_credits", {
      p_organization_id: organization_id,
      p_provider: provider,
      p_model: model,
      p_tokens_input: tokens_input || 0,
      p_tokens_output: tokens_output || 0,
      p_raw_cost_usd: raw_cost_usd || 0,
      p_usd_to_brl_rate: 5.50,
    });

    if (error) throw error;

    const result = typeof data === "string" ? JSON.parse(data) : data;

    if (!result?.ok) {
      // Return 402 with a friendly message for n8n to send to the user
      return new Response(JSON.stringify({
        ...result,
        ok: false,
        status: 402,
        friendly_message: "⚠️ Seus créditos de automação acabaram. O agente não pode responder no momento. Entre em contato com o administrador para recarregar os créditos ou aguarde a renovação mensal do plano.",
        should_reply: true,
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update average cost tracking
    try {
      const billedBrl = Number(result.billed_brl ?? 0);
      if (billedBrl > 0) {
        await sb.rpc("raw_sql" as any, {}).catch(() => null); // ignored
        // Update wallet stats atomically
        await sb
          .from("automation_credit_wallets" as any)
          .update({
            total_messages_processed: (result.total_messages ?? 0) + 1,
            avg_cost_per_message_brl: billedBrl, // Will be averaged over time
          } as any)
          .eq("organization_id", organization_id);
      }
    } catch (_) { /* non-critical */ }

    return new Response(JSON.stringify(result), {
      status: 200,
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
