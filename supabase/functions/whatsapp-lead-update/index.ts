/**
 * whatsapp-lead-update — Atualiza campos de um lead existente.
 * Auth: X-Webhook-Secret (WHATSAPP_AGENT_SECRET)
 *
 * Aceita tanto formato nested { updates: { ... } } quanto flat { name, email, ... }
 */

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

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

    const { instance_name, phone, lead_id } = body as any;

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

    // Support both nested `updates` object AND flat params
    const ALLOWED_FIELDS = [
      "name", "email", "phone", "temperature", "notes",
      "transaction_interest", "preferred_neighborhoods",
    ];

    let updates: Record<string, unknown> = {};
    if (body.updates && typeof body.updates === "object") {
      updates = body.updates as Record<string, unknown>;
    } else {
      // Flat params — extract allowed fields from top level
      for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
          updates[key] = body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No update fields provided" }),
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

    // Build safe updates
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
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
