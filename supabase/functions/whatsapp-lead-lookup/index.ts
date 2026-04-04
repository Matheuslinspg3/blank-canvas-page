/**
 * whatsapp-lead-lookup — Busca lead por telefone ou email.
 * Auth: X-Webhook-Secret (WHATSAPP_AGENT_SECRET)
 *
 * Payload:
 * { instance_name, phone?, email? }
 *
 * Retorna dados do lead encontrado ou { found: false }.
 */

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const secret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { instance_name, phone, email } = body;

    if (!instance_name) {
      return new Response(
        JSON.stringify({ error: "instance_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!phone && !email) {
      return new Response(
        JSON.stringify({ error: "phone or email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createServiceClient();

    // Resolve org from instance
    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .maybeSingle();

    const orgId = config?.organization_id;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: `Instance '${instance_name}' not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let lead = null;

    // Search by phone (last 8 digits)
    if (phone) {
      const normalized = phone.replace(/\D/g, "");
      if (normalized.length >= 8) {
        const { data } = await sb
          .from("leads")
          .select("id, name, email, phone, temperature, source, notes, stage, created_at, updated_at, transaction_interest, preferred_neighborhoods")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .ilike("phone", `%${normalized.slice(-8)}`)
          .limit(1);
        if (data && data.length > 0) lead = data[0];
      }
    }

    // Fallback: search by email
    if (!lead && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const { data } = await sb
        .from("leads")
        .select("id, name, email, phone, temperature, source, notes, stage, created_at, updated_at, transaction_interest, preferred_neighborhoods")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .ilike("email", normalizedEmail)
        .limit(1);
      if (data && data.length > 0) lead = data[0];
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ found: false, message: "Nenhum lead encontrado com esse contato." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ found: true, lead }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[whatsapp-lead-lookup] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
