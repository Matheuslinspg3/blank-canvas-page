// Trigger an outbound phone call via Retell AI for a specific lead.
// Auth: X-Webhook-Secret (internal worker) OR service role bearer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET") || Deno.env.get("WEBHOOK_SECRET") || "";

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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, organization_id, phone, queue_id } = body;
    if (!lead_id || !organization_id || !phone) {
      return new Response(JSON.stringify({ error: "lead_id, organization_id e phone são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNumber = normalizeBR(phone);
    if (!toNumber) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: cfg } = await supabase
      .from("retell_agent_config")
      .select("agent_id, retell_from_number, qualification_prompt, transfer_keywords")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!cfg?.agent_id || !cfg?.retell_from_number) {
      return new Response(JSON.stringify({ error: "Agent ID ou from_number não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = {
      organization_id,
      lead_id,
      queue_id: queue_id ?? null,
      qualification_prompt: cfg.qualification_prompt,
      transfer_keywords: cfg.transfer_keywords,
    };

    const retellRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        from_number: cfg.retell_from_number,
        to_number: toNumber,
        override_agent_id: cfg.agent_id,
        metadata,
      }),
    });

    const text = await retellRes.text();
    if (!retellRes.ok) {
      console.error("Retell API error:", retellRes.status, text);
      return new Response(JSON.stringify({ error: "Falha Retell", status: retellRes.status, details: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let callData: any = {};
    try { callData = JSON.parse(text); } catch { /* ignore */ }

    await supabase.from("voice_calls").insert({
      organization_id,
      call_id: callData.call_id,
      agent_id: cfg.agent_id,
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
    console.error("retell-trigger-outbound-call error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
