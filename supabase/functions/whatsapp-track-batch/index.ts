/**
 * whatsapp-track-batch — Recebe custos de IA agregados por mensagem do N8N.
 * Insere na tabela whatsapp_ai_usage (granular) E na ai_token_usage_events (billing geral).
 *
 * Auth: X-Webhook-Secret (WHATSAPP_AGENT_SECRET)
 *
 * Payload esperado do N8N (Code node "CALCULAR-CUSTOS-IA"):
 * {
 *   instance_name: string,
 *   remote_jid: string,
 *   message_id?: string,
 *   message_type: "text" | "audio" | "image",
 *   voice_enabled: boolean,
 *   steps: [{ step, provider, model, input_tokens, output_tokens, cost_usd }],
 *   totals: { input_tokens, output_tokens, cost_usd, cost_brl }
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const secret = req.headers.get("x-webhook-secret");
    const expected = Deno.env.get("WHATSAPP_AGENT_SECRET");
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      instance_name,
      remote_jid,
      message_id,
      message_type = "text",
      voice_enabled = false,
      steps = [],
      totals,
    } = body;

    if (!instance_name || !remote_jid || !totals) {
      return new Response(
        JSON.stringify({ error: "Missing: instance_name, remote_jid, totals" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve org
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .maybeSingle();

    const orgId = instance?.organization_id || null;

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Instance not found", instance_name }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Insert granular row
    const { error: insertErr } = await supabase.from("whatsapp_ai_usage").insert({
      organization_id: orgId,
      instance_name,
      remote_jid,
      message_id: message_id || null,
      message_type,
      steps,
      total_input_tokens: totals.input_tokens || 0,
      total_output_tokens: totals.output_tokens || 0,
      total_cost_usd: totals.cost_usd || 0,
      total_cost_brl: totals.cost_brl || 0,
      voice_enabled,
    });

    if (insertErr) {
      console.error("[whatsapp-track-batch] Insert error:", insertErr);
    }

    // 2. Also track each step in billing system for budget enforcement
    const billingPromises = steps.map((s: any) =>
      trackAiBilling(supabase, {
        userId: "system",
        organizationId: orgId,
        provider: s.provider || "unknown",
        model: s.model || "unknown",
        functionName: `whatsapp-agent/${s.step}`,
        inputTokens: s.input_tokens || 0,
        outputTokens: s.output_tokens || 0,
        success: true,
        usageType: s.step === "tts" ? "audio" : s.step === "descrever" ? "image" : "text",
        metadata: {
          source: "n8n-batch",
          instance_name,
          remote_jid,
          message_type,
        },
      }).catch(() => {})
    );

    await Promise.all(billingPromises);

    // 3. Check budget
    let budgetWarning: string | null = null;
    const { data: budget } = await supabase
      .from("ai_org_budgets")
      .select("monthly_budget_usd, current_month_spend_usd, alert_threshold_pct, action_on_limit")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (budget) {
      const newSpend = (budget.current_month_spend_usd || 0) + (totals.cost_usd || 0);
      const pct = (newSpend / budget.monthly_budget_usd) * 100;

      if (pct >= 100) {
        budgetWarning = `BUDGET_EXCEEDED: ${pct.toFixed(1)}% (action: ${budget.action_on_limit})`;
      } else if (pct >= (budget.alert_threshold_pct || 80)) {
        budgetWarning = `BUDGET_ALERT: ${pct.toFixed(1)}%`;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: orgId,
        tracked_steps: steps.length,
        total_cost_usd: totals.cost_usd,
        budget_warning: budgetWarning,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-track-batch] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
