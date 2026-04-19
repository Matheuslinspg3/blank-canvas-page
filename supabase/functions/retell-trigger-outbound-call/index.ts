// Trigger an outbound phone call via Retell AI for a specific lead.
// Auth: X-Webhook-Secret (internal worker) OR service role bearer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateRetellManualCall } from "../_shared/retellConfigCheck.ts";
import { maskPhone } from "../_shared/voiceConsent.ts";

const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET") || Deno.env.get("WEBHOOK_SECRET") || "";
const DEFAULT_FROM_NUMBER = Deno.env.get("RETELL_DEFAULT_FROM_NUMBER") || "";

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "retell.trigger", event, ...data }));
}

function normalizeBR(p: string): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55") && d.length >= 12) return "+" + d;
  if (d.length === 10 || d.length === 11) return "+55" + d;
  return "+" + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    const auth = req.headers.get("Authorization");
    const isWebhook = WEBHOOK_SECRET && secret === WEBHOOK_SECRET;
    const isService = auth === `Bearer ${SERVICE_KEY}`;
    if (!isWebhook && !isService) {
      log("unauthorized", {});
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, organization_id, phone, queue_id } = body;
    if (!lead_id || !organization_id || !phone) {
      log("bad_request", { lead_id, organization_id, has_phone: !!phone });
      return new Response(JSON.stringify({ error: "lead_id, organization_id e phone são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("request_received", { lead_id, org_id: organization_id, queue_id, phone: maskPhone(phone) });

    const toNumber = normalizeBR(phone);
    if (!toNumber) {
      log("invalid_phone", { lead_id, phone: maskPhone(phone) });
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: cfg } = await supabase
      .from("retell_agent_config")
      .select("agent_id, retell_from_number, qualification_prompt, transfer_keywords, enabled, auto_outbound_enabled")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Resolve from_number: org-specific OR global platform fallback
    const resolvedFromNumber = cfg?.retell_from_number || DEFAULT_FROM_NUMBER;
    const cfgForCheck = { ...(cfg ?? {}), retell_from_number: resolvedFromNumber };
    const cfgCheck = validateRetellManualCall(cfgForCheck);
    if (!cfgCheck.ok) {
      log("config_invalid", { lead_id, org_id: organization_id, reason: cfgCheck.reason });
      return new Response(JSON.stringify({ error: "Configuração inválida", reason: cfgCheck.reason }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = {
      organization_id,
      lead_id,
      queue_id: queue_id ?? null,
      qualification_prompt: cfg!.qualification_prompt,
      transfer_keywords: cfg!.transfer_keywords,
    };

    log("retell_request", { lead_id, agent_id: cfg!.agent_id, to: maskPhone(toNumber) });

    const retellRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        from_number: resolvedFromNumber,
        to_number: toNumber,
        override_agent_id: cfg!.agent_id,
        metadata,
      }),
    });

    const text = await retellRes.text();
    if (!retellRes.ok) {
      log("retell_error", { lead_id, status: retellRes.status, body: text.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Falha Retell", status: retellRes.status, details: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let callData: any = {};
    try { callData = JSON.parse(text); } catch { /* ignore */ }

    log("retell_response_ok", { lead_id, call_id: callData.call_id });

    await supabase.from("voice_calls").insert({
      organization_id,
      call_id: callData.call_id,
      agent_id: cfg!.agent_id,
      call_type: "phone_call",
      call_status: "registered",
      lead_id,
      metadata,
      started_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, call_id: callData.call_id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("internal_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
