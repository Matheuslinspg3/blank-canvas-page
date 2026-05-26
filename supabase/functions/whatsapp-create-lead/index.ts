import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Auth: accept webhook secret OR valid JWT
    const secret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("X-Webhook-Secret");
    const authHeader = req.headers.get("authorization") || "";
    let jwtOrgId: string | null = null;

    if (secret && WEBHOOK_SECRET && secret === WEBHOOK_SECRET) {
      // Webhook auth — org resolved from instance_name below
    } else if (authHeader.startsWith("Bearer ")) {
      // JWT auth — resolve org from user profile
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user }, error: userErr } = await anonClient.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sb = createServiceClient();
      const { data: profile } = await sb
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      jwtOrgId = profile?.organization_id || null;
      if (!jwtOrgId) {
        return new Response(JSON.stringify({ error: "No organization" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (!raw || !raw.trim()) {
        return new Response(
          JSON.stringify({ error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Clean potential LLM artifacts
      let cleaned = raw.trim()
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "");
      const jsonStart = cleaned.search(/\{/);
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return new Response(
          JSON.stringify({ error: "No valid JSON object found in body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      try {
        body = JSON.parse(cleaned);
      } catch {
        // Fix trailing commas and control chars
        cleaned = cleaned
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, "");
        body = JSON.parse(cleaned);
      }
    } catch (parseErr: any) {
      console.error("JSON parse error:", parseErr.message);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", detail: parseErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      instance_name,
      name,
      phone,
      email,
      notes,
      temperature,
      source,
      interested_property_type,
      preferred_neighborhoods,
      transaction_interest,
      qualified,
    } = body as any;

    if (!instance_name && !jwtOrgId) {
      return new Response(
        JSON.stringify({ error: "instance_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!name && !phone && !email) {
      return new Response(
        JSON.stringify({ error: "At least name, phone or email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createServiceClient();

    // Resolve organization: JWT auth already has orgId, webhook auth resolves from instance
    let orgId = jwtOrgId;
    let agentCfg: { crm_new_lead_stage_id: string | null; crm_qualified_stage_id: string | null; crm_auto_advance_on_qualified: boolean } | null = null;
    if (instance_name) {
      const { data: config, error: configError } = await sb
        .from("whatsapp_agent_config")
        .select("organization_id, crm_new_lead_stage_id, crm_qualified_stage_id, crm_auto_advance_on_qualified")
        .eq("instance_name", instance_name)
        .single();

      if (!orgId) {
        if (configError || !config?.organization_id) {
          return new Response(
            JSON.stringify({ error: `Instance '${instance_name}' not found` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        orgId = config.organization_id;
      }
      if (config) {
        agentCfg = {
          crm_new_lead_stage_id: config.crm_new_lead_stage_id ?? null,
          crm_qualified_stage_id: config.crm_qualified_stage_id ?? null,
          crm_auto_advance_on_qualified: config.crm_auto_advance_on_qualified ?? true,
        };
      }
    }

    // Normalize phone for dedup
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Check for duplicates by phone or email
    let existingLead = null;

    if (normalizedPhone && normalizedPhone.length >= 8) {
      const { data } = await sb
        .from("leads")
        .select("id, name, email, phone")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .ilike("phone", `%${normalizedPhone.slice(-8)}`);
      if (data && data.length > 0) existingLead = data[0];
    }

    if (!existingLead && normalizedEmail) {
      const { data } = await sb
        .from("leads")
        .select("id, name, email, phone")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .ilike("email", normalizedEmail);
      if (data && data.length > 0) existingLead = data[0];
    }

    if (existingLead) {
      // Update existing lead with new info if missing
      const updates: Record<string, unknown> = {};
      if (!existingLead.email && normalizedEmail) updates.email = normalizedEmail;
      if (!existingLead.phone && phone) updates.phone = phone;
      if (temperature) updates.temperature = temperature;
      if (notes) updates.notes = (existingLead as any).notes
        ? `${(existingLead as any).notes}\n[WhatsApp] ${notes}`
        : `[WhatsApp] ${notes}`;

      // Auto-advance to qualified stage if flag set
      if (qualified === true && agentCfg?.crm_auto_advance_on_qualified && agentCfg?.crm_qualified_stage_id) {
        updates.lead_stage_id = agentCfg.crm_qualified_stage_id;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await sb.from("leads").update(updates).eq("id", existingLead.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "updated",
          lead_id: existingLead.id,
          message: `Lead '${existingLead.name}' já existe e foi atualizado.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve initial stage: prefer configured stage, fallback to first by position
    let stageId: string | null = null;
    if (qualified === true && agentCfg?.crm_auto_advance_on_qualified && agentCfg?.crm_qualified_stage_id) {
      stageId = agentCfg.crm_qualified_stage_id;
    } else if (agentCfg?.crm_new_lead_stage_id) {
      stageId = agentCfg.crm_new_lead_stage_id;
    } else {
      const { data: stages } = await sb
        .from("lead_stages")
        .select("id")
        .eq("organization_id", orgId)
        .order("position", { ascending: true })
        .limit(1);
      stageId = stages?.[0]?.id || null;
    }

    // Get a system user or first admin for created_by
    const { data: members } = await sb
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1);

    const createdBy = members?.[0]?.id;
    if (!createdBy) {
      return new Response(
        JSON.stringify({ error: "No users found in organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const leadName = name || (phone ? `WhatsApp ${phone}` : email || "Lead WhatsApp");

    // Resolve property type IDs if provided
    let propertyTypeIds: string[] = [];
    if (interested_property_type) {
      const { data: types } = await sb
        .from("property_types")
        .select("id, name")
        .eq("organization_id", orgId);
      if (types) {
        const match = types.find(
          (t) => t.name.toLowerCase() === interested_property_type.toLowerCase(),
        );
        if (match) propertyTypeIds = [match.id];
      }
    }

    const { data: newLead, error: insertError } = await sb
      .from("leads")
      .insert({
        organization_id: orgId,
        created_by: createdBy,
        name: leadName,
        email: normalizedEmail,
        phone: phone || null,
        source: source || "whatsapp",
        notes: notes ? `[WhatsApp] ${notes}` : null,
        temperature: temperature || "morno",
        stage: "novo",
        lead_stage_id: stageId,
        interested_property_type_ids: propertyTypeIds,
        preferred_neighborhoods: preferred_neighborhoods || [],
        transaction_interest: transaction_interest || null,
        consent_voice_call: resolveVoiceConsent({ source: source || "whatsapp", explicit: null, hasPhone: !!phone }),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "created",
        lead_id: newLead.id,
        message: `Lead '${leadName}' criado com sucesso no CRM.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("whatsapp-create-lead error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
