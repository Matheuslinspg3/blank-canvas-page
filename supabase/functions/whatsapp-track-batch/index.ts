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

    // Resolve org — accept either the real instance_name OR a bare organization_id (UUID).
    // The N8N "ENVIAR-TRACK-BATCH" node was sending the organization_id as instance_name,
    // which caused 404 "Instance not found" on every batch. Try both lookups.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let orgId: string | null = null;

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .maybeSingle();
    orgId = instance?.organization_id || null;

    // Fallback 1: instance_name is actually a UUID → treat as organization_id
    if (!orgId && UUID_RE.test(instance_name)) {
      const { data: byOrg } = await supabase
        .from("whatsapp_instances")
        .select("organization_id")
        .eq("organization_id", instance_name)
        .maybeSingle();
      orgId = byOrg?.organization_id || (UUID_RE.test(instance_name) ? instance_name : null);
    }

    // Fallback 2: try suffix match (instance_name ends with the UUID we received)
    if (!orgId) {
      const { data: bySuffix } = await supabase
        .from("whatsapp_instances")
        .select("organization_id")
        .ilike("instance_name", `%${instance_name}`)
        .maybeSingle();
      orgId = bySuffix?.organization_id || null;
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Instance not found", instance_name }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve unresolved model expressions (e.g. "={{ $('IDENTIDADE')... }}")
    let resolvedModelName: string | null = null;
    const hasUnresolvedModel = steps.some((s: any) =>
      typeof s.model === "string" && (s.model.includes("={{") || s.model.includes("$('"))
    );

    if (hasUnresolvedModel) {
      // Fetch actual model from the org's agent config
      const { data: agentCfg } = await supabase
        .from("whatsapp_agent_config")
        .select("ai_model")
        .eq("organization_id", orgId)
        .maybeSingle();
      resolvedModelName = agentCfg?.ai_model || null;
      console.log(`[whatsapp-track-batch] Resolved model from config: ${resolvedModelName}`);
    }

    // Fix steps with unresolved model names
    const fixedSteps = steps.map((s: any) => {
      let model = s.model || "unknown";
      if (typeof model === "string" && (model.includes("={{") || model.includes("$("))) {
        model = resolvedModelName || "gpt-4o-mini";
      }
      return { ...s, model };
    });

    // Recalculate costs for steps that had zero cost
    const { estimateCostForStep } = (() => {
      const PRICING: Record<string, { input: number; output: number }> = {
        "gpt-4o": { input: 0.0025, output: 0.01 },
        "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
        "gpt-5": { input: 0.005, output: 0.015 },
        "gpt-5-mini": { input: 0.001, output: 0.004 },
      };
      return {
        estimateCostForStep: (model: string, inTok: number, outTok: number) => {
          const p = PRICING[model];
          if (!p) return 0;
          return (inTok / 1000) * p.input + (outTok / 1000) * p.output;
        },
      };
    })();

    // Recalculate totals with correct costs
    let recalcTotalCost = 0;
    for (const s of fixedSteps) {
      if (!s.cost_usd || s.cost_usd === 0) {
        s.cost_usd = estimateCostForStep(s.model, s.input_tokens || 0, s.output_tokens || 0);
      }
      recalcTotalCost += s.cost_usd || 0;
    }

    const fixedTotals = {
      ...totals,
      cost_usd: recalcTotalCost > 0 ? recalcTotalCost : totals.cost_usd || 0,
      cost_brl: recalcTotalCost > 0 ? recalcTotalCost * 5.5 : totals.cost_brl || 0,
    };

    // 1. Insert granular row
    const { error: insertErr } = await supabase.from("whatsapp_ai_usage").insert({
      organization_id: orgId,
      instance_name,
      remote_jid,
      message_id: message_id || null,
      message_type,
      steps: fixedSteps,
      total_input_tokens: fixedTotals.input_tokens || 0,
      total_output_tokens: fixedTotals.output_tokens || 0,
      total_cost_usd: fixedTotals.cost_usd || 0,
      total_cost_brl: fixedTotals.cost_brl || 0,
      voice_enabled,
    });

    if (insertErr) {
      console.error("[whatsapp-track-batch] Insert error:", insertErr);
    }

    // 1b. Update estimated_cost_usd on the whatsapp_messages row
    if (message_id && fixedTotals.cost_usd > 0) {
      const { error: updateErr } = await supabase
        .from("whatsapp_messages")
        .update({ estimated_cost_usd: fixedTotals.cost_usd })
        .eq("message_id", message_id);
      if (updateErr) {
        console.error("[whatsapp-track-batch] Message cost update error:", updateErr);
      }
    }

    // 2. Also track each step in billing system for budget enforcement
    const billingPromises = fixedSteps.map((s: any) =>
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
      const newSpend = (budget.current_month_spend_usd || 0) + (fixedTotals.cost_usd || 0);
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
        tracked_steps: fixedSteps.length,
        total_cost_usd: fixedTotals.cost_usd,
        total_cost_brl: fixedTotals.cost_brl,
        model_resolved: resolvedModelName || null,
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
