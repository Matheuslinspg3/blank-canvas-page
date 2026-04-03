/**
 * whatsapp-track-batch — Recebe dados brutos de IA do N8N e calcula custos server-side.
 * Insere na tabela whatsapp_ai_usage (granular) E na ai_token_usage_events (billing geral).
 *
 * Auth: X-Webhook-Secret (WHATSAPP_AGENT_SECRET)
 *
 * Payload do N8N (Set node simples):
 * {
 *   instance_name: string,
 *   remote_jid: string,
 *   message_id?: string,
 *   message_type: "conversation" | "audioMessage" | "imageMessage",
 *   agent_output: string,      // output do ATENDENTEPORTOCAICARA
 *   system_prompt: string,     // system prompt completo
 *   user_message: string       // mensagem do usuário
 * }
 *
 * OU o formato legado com steps/totals pré-calculados.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Pricing per 1K tokens (USD)
const RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
};
const TTS_PER_CHAR = 0.00030;
const BRL_RATE = 5.70;

interface Step {
  step: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

function calculateCosts(body: any): { steps: Step[]; totals: any; message_type: string; voice_enabled: boolean } {
  const agentOutput = String(body.agent_output || "");
  const systemPrompt = String(body.system_prompt || "");
  const userMsg = String(body.user_message || "");
  const rawType = String(body.message_type || "conversation");

  // Normalize message type
  const msgType = rawType.replace("Message", "").toLowerCase();
  const isAudio = msgType === "audio" || rawType === "audioMessage";
  const isImage = msgType === "image" || rawType === "imageMessage";
  const hasVoice = agentOutput.includes("#VOZAI");
  const cleanOutput = agentOutput.replaceAll("#VOZAI", "");

  const steps: Step[] = [];

  // 1. Agent GPT-4o (always runs)
  const agentIn = Math.ceil((systemPrompt.length + userMsg.length) / 3.5);
  const agentOut = Math.ceil(cleanOutput.length / 3.5);
  steps.push({
    step: "agent",
    provider: "openai",
    model: "gpt-4o",
    input_tokens: agentIn,
    output_tokens: agentOut,
    cost_usd: (agentIn / 1000) * RATES["gpt-4o"].input + (agentOut / 1000) * RATES["gpt-4o"].output,
  });

  // 2. Transcritor (audio only)
  if (isAudio) {
    const tIn = 500;
    const tOut = 100;
    steps.push({
      step: "transcritor",
      provider: "google",
      model: "gemini-2.5-flash",
      input_tokens: tIn,
      output_tokens: tOut,
      cost_usd: (tIn / 1000) * RATES["gemini-2.5-flash"].input + (tOut / 1000) * RATES["gemini-2.5-flash"].output,
    });
  }

  // 3. Descrever (image only)
  if (isImage) {
    const dIn = 258;
    const dOut = 200;
    steps.push({
      step: "descrever",
      provider: "google",
      model: "gemini-2.0-flash",
      input_tokens: dIn,
      output_tokens: dOut,
      cost_usd: (dIn / 1000) * RATES["gemini-2.0-flash"].input + (dOut / 1000) * RATES["gemini-2.0-flash"].output,
    });
  }

  // 4. Parser (always runs after agent)
  const parserIn = Math.ceil(cleanOutput.length / 3.5);
  const parserOut = Math.ceil(cleanOutput.length / 4);
  steps.push({
    step: "parser",
    provider: "google",
    model: "gemini-2.0-flash",
    input_tokens: parserIn,
    output_tokens: parserOut,
    cost_usd: (parserIn / 1000) * RATES["gemini-2.0-flash"].input + (parserOut / 1000) * RATES["gemini-2.0-flash"].output,
  });

  // 5. TTS ElevenLabs (only if #VOZAI tag present)
  if (hasVoice && cleanOutput.length > 0) {
    steps.push({
      step: "tts",
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      input_tokens: cleanOutput.length,
      output_tokens: 0,
      cost_usd: cleanOutput.length * TTS_PER_CHAR,
    });
  }

  const totalIn = steps.reduce((s, x) => s + x.input_tokens, 0);
  const totalOut = steps.reduce((s, x) => s + x.output_tokens, 0);
  const totalUsd = steps.reduce((s, x) => s + x.cost_usd, 0);

  return {
    steps,
    totals: {
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: totalUsd,
      cost_brl: totalUsd * BRL_RATE,
    },
    message_type: isAudio ? "audio" : isImage ? "image" : "text",
    voice_enabled: hasVoice,
  };
}

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
    const { instance_name, remote_jid, message_id } = body;

    if (!instance_name || !remote_jid) {
      return new Response(
        JSON.stringify({ error: "Missing: instance_name, remote_jid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if payload has pre-calculated steps or raw data
    let steps: Step[];
    let totals: any;
    let message_type: string;
    let voice_enabled: boolean;

    if (body.steps && body.totals) {
      // Legacy format: steps/totals already calculated by N8N
      steps = body.steps;
      totals = body.totals;
      message_type = body.message_type || "text";
      voice_enabled = body.voice_enabled || false;
    } else {
      // New format: raw data — calculate server-side
      const calculated = calculateCosts(body);
      steps = calculated.steps;
      totals = calculated.totals;
      message_type = calculated.message_type;
      voice_enabled = calculated.voice_enabled;
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

    // 2. Track each step in billing system
    const billingPromises = steps.map((s: Step) =>
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
        total_cost_brl: totals.cost_brl,
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
