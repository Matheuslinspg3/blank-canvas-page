/**
 * whatsapp-lead-update — Atualiza campos de um lead existente.
 * Auth: X-Webhook-Secret (WHATSAPP_AGENT_SECRET)
 *
 * Payload:
 * {
 *   instance_name: string,
 *   phone: string,           // identifica o lead (últimos 8 dígitos)
 *   lead_id?: string,        // alternativa: ID direto
 *   updates: {
 *     name?: string,
 *     email?: string,
 *     phone?: string,
 *     temperature?: string,
 *     notes?: string,
 *     transaction_interest?: string,
 *     preferred_neighborhoods?: string[],
 *   }
 * }
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
    const { instance_name, phone, lead_id, updates } = body;

    if (!instance_name) {
      return new Response(
        JSON.stringify({ error: "instance_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!phone && !lead_id) {
      return new Response(
        JSON.stringify({ error: "phone or lead_id is required to identify the lead" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "updates object is required with at least one field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createServiceClient();

    // Resolve org
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

    // Find lead
    let leadRecord: any = null;

    if (lead_id) {
      const { data } = await sb
        .from("leads")
        .select("id, name, notes")
        .eq("id", lead_id)
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .maybeSingle();
      leadRecord = data;
    } else if (phone) {
      const normalized = phone.replace(/\D/g, "");
      if (normalized.length >= 8) {
        const { data } = await sb
          .from("leads")
          .select("id, name, notes")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .ilike("phone", `%${normalized.slice(-8)}`)
          .limit(1);
        if (data && data.length > 0) leadRecord = data[0];
      }
    }

    if (!leadRecord) {
      return new Response(
        JSON.stringify({ found: false, message: "Lead não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Whitelist of allowed update fields
    const ALLOWED_FIELDS = [
      "name", "email", "phone", "temperature", "notes",
      "transaction_interest", "preferred_neighborhoods",
    ];

    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        // Append notes instead of replacing
        if (key === "notes" && value) {
          safeUpdates.notes = leadRecord.notes
            ? `${leadRecord.notes}\n[WhatsApp IA] ${value}`
            : `[WhatsApp IA] ${value}`;
        } else {
          safeUpdates[key] = value;
        }
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return new Response(
        JSON.stringify({ success: true, action: "no_changes", lead_id: leadRecord.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    safeUpdates.updated_at = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("leads")
      .update(safeUpdates)
      .eq("id", leadRecord.id);

    if (updateErr) {
      console.error("[whatsapp-lead-update] DB error:", updateErr);
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "updated",
        lead_id: leadRecord.id,
        updated_fields: Object.keys(safeUpdates).filter(k => k !== "updated_at"),
        message: `Lead '${leadRecord.name}' atualizado com sucesso.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[whatsapp-lead-update] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
