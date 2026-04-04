import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function parseBody(raw: string): Record<string, unknown> {
  let cleaned = raw.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const s = cleaned.search(/\{/);
  const e = cleaned.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON object");
  cleaned = cleaned.substring(s, e + 1);
  try { return JSON.parse(cleaned); } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("WHATSAPP_AGENT_SECRET");
    const headerSecret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (!secret || headerSecret !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (!raw || !raw.trim()) {
        return new Response(JSON.stringify({ error: "Empty request body" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = parseBody(raw);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Invalid JSON", detail: err.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_name, remote_jid, summary } = body as any;

    if (!instance_name || !remote_jid) {
      return new Response(
        JSON.stringify({ error: "Missing: instance_name, remote_jid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Resolve org from instance_name
    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .single();

    if (!config?.organization_id) {
      return new Response(
        JSON.stringify({ error: "Organization not found for instance" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = config.organization_id;

    // 2. Extract customer phone for wa.me link
    const customerPhone = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    const waMeLink = `https://wa.me/${customerPhone}`;

    // 3. Find available brokers
    const { data: brokers } = await sb
      .from("profiles")
      .select("user_id, full_name, phone")
      .eq("organization_id", orgId)
      .is("removed_at", null)
      .not("phone", "is", null)
      .order("created_at", { ascending: true });

    if (!brokers || brokers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nenhum corretor disponível com telefone cadastrado",
          wa_me_link: waMeLink,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check broker_assignment_mode
    const { data: qualConfig } = await sb
      .from("ai_qualification_config")
      .select("broker_assignment_mode")
      .eq("organization_id", orgId)
      .single();

    const mode = qualConfig?.broker_assignment_mode || "round_robin";
    let selectedBroker = brokers[0];

    if (mode === "round_robin") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const counts = await Promise.all(
        brokers.map(async (b) => {
          const { count } = await sb
            .from("whatsapp_audit_log")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("action", "transfer_to_broker")
            .eq("actor_id", b.user_id)
            .gte("created_at", since);
          return { broker: b, count: count || 0 };
        })
      );
      counts.sort((a, b) => a.count - b.count);
      selectedBroker = counts[0].broker;
    }

    // 5. Build notification message
    const brokerPhone = selectedBroker.phone!.replace(/\D/g, "");
    const conversationSummary = summary || "Sem resumo disponível";

    const notificationText = [
      `🔔 *Transferência de Atendimento*`,
      ``,
      `Um cliente solicitou atendimento humano.`,
      ``,
      `📋 *Resumo da conversa:*`,
      conversationSummary,
      ``,
      `📱 *Link direto:* ${waMeLink}`,
      ``,
      `Clique no link acima para iniciar o atendimento.`,
    ].join("\n");

    // 6. Send WhatsApp message to broker via Evolution API
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    let messageSent = false;

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      const endpoint = `${baseUrl}/message/sendText/${instance_name}`;
      const evoRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: brokerPhone, text: notificationText }),
      });
      messageSent = evoRes.ok;
      if (!evoRes.ok) console.warn("Failed to send broker notification:", await evoRes.text());
    }

    // 7. Audit log
    try {
      await sb.from("whatsapp_audit_log").insert({
        organization_id: orgId,
        action: "transfer_to_broker",
        actor_id: selectedBroker.user_id,
        details: {
          customer_phone: customerPhone,
          broker_name: selectedBroker.full_name,
          broker_phone: brokerPhone,
          assignment_mode: mode,
          message_sent: messageSent,
        },
      });
    } catch (e) {
      console.warn("Audit log error:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        broker: { name: selectedBroker.full_name, phone: brokerPhone },
        wa_me_link: waMeLink,
        summary: conversationSummary,
        message_sent: messageSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-transfer-broker error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
