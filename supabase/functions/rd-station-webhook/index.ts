import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("token");
    const orgParam = url.searchParams.get("org");

    if (!secret) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query — validate token; optionally match org prefix for extra safety
    let query = supabase
      .from("rd_station_settings")
      .select("*")
      .eq("webhook_secret", secret)
      .eq("is_active", true);

    const { data: allMatches, error: settingsError } = await query;

    if (settingsError || !allMatches || allMatches.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive webhook" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If org param provided, match by prefix for extra identification
    let settings = allMatches[0];
    if (orgParam && allMatches.length > 0) {
      const match = allMatches.find((s: any) => s.organization_id.startsWith(orgParam));
      if (match) settings = match;
    }

    const orgId = settings.organization_id;

    const payload = await req.json();

    // RD Station Marketing webhook payload structure
    // https://developers.rdstation.com/reference/webhooks
    // The conversion identifier / event name lives at the ROOT of the payload,
    // not inside each lead object.
    const topLevelEventId = payload.event_identifier || payload.conversion_identifier || null;
    const topLevelEventType = payload.event_type || null;

    const leads = payload.leads || [payload];

    const results: any[] = [];

    for (const leadData of leads) {
      let leadId: string | null = null;
      let status = "processed";
      let errorMessage: string | null = null;

      try {
        // Extract lead fields from RD Station format
        const name =
          leadData.name ||
          leadData.nome ||
          `${leadData.first_name || ""} ${leadData.last_name || ""}`.trim() ||
          "Lead RD Station";
        const email = leadData.email || leadData.personal_email || null;
        const phone =
          leadData.personal_phone ||
          leadData.mobile_phone ||
          leadData.phone ||
          leadData.telefone ||
          null;
        const source = "RD Station (Webhook)";

        // Check for duplicate by email
        let existingLead: any = null;
        if (email) {
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("organization_id", orgId)
            .eq("email", email)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (existing) existingLead = existing;
        }

        // Check for duplicate by phone if no email match
        if (!existingLead && phone) {
          const normalizedPhone = phone.replace(/\D/g, "");
          if (normalizedPhone.length >= 8) {
            const { data: allLeads } = await supabase
              .from("leads")
              .select("id, phone")
              .eq("organization_id", orgId)
              .eq("is_active", true)
              .not("phone", "is", null);
            const match = (allLeads || []).find((l: any) => {
              const lPhone = (l.phone || "").replace(/\D/g, "");
              return lPhone.length >= 8 && (lPhone === normalizedPhone || lPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(lPhone));
            });
            if (match) existingLead = match;
          }
        }

        if (existingLead) {
          leadId = existingLead.id;
          status = "duplicate";
          results.push({ name, email, status: "duplicate", leadId });
          continue;
        }

        if (settings.auto_send_to_crm) {
          // Get admin user for created_by
          const { data: adminProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("organization_id", orgId)
            .limit(1)
            .single();

          if (!adminProfile) {
            throw new Error("No user found in organization");
          }

          // Use upsert-style insert: if a race condition causes a duplicate email,
          // the unique index will reject it and we treat it as duplicate
          const propertyId = await matchProperty(supabase, orgId, leadData);

          // Extract conversion identifier and traffic source
          const conversionId = extractConversionIdentifier(leadData);
          const trafficSource = leadData.traffic_source || 
            leadData.first_conversion?.content?.source || 
            leadData.first_conversion?.source || null;

          const { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert({
              organization_id: orgId,
              name,
              email,
              phone,
              source,
              lead_stage_id: settings.default_stage_id,
              created_by: adminProfile.user_id,
              external_id: leadData.id?.toString() || null,
              external_source: "rdstation",
              notes: buildNotes(leadData),
              property_id: propertyId,
              conversion_identifier: conversionId,
              traffic_source: trafficSource,
            })
            .select("id")
            .single();

          if (insertError) {
            // Unique constraint violation = race condition duplicate
            if (insertError.code === "23505") {
              status = "duplicate";
              results.push({ name, email, status: "duplicate" });
              continue;
            }
            throw insertError;
          }
          leadId = newLead?.id || null;
          status = "created";

          // Notify org managers about new RD Station lead
          if (newLead?.id) {
            const { data: managers } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("role", ["admin", "sub_admin"]);

            const orgManagers = managers || [];
            for (const mgr of orgManagers) {
              // Verify manager belongs to this org
              const { data: mgrProfile } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("user_id", mgr.user_id)
                .eq("organization_id", orgId)
                .maybeSingle();

              if (mgrProfile) {
                await supabase.rpc("insert_notification", {
                  p_user_id: mgrProfile.user_id,
                  p_organization_id: orgId,
                  p_type: "rd_lead_received",
                  p_title: "Novo lead do RD Station",
                  p_message: `O lead "${name}" chegou via webhook do RD Station.`,
                  p_entity_id: newLead.id,
                  p_entity_type: "lead",
                });
              }
            }
          }
        } else {
          status = "received_not_sent";
        }

        results.push({ name, email, status, leadId });
      } catch (err: any) {
        errorMessage = err.message || "Unknown error";
        status = "error";
        results.push({ status: "error", error: errorMessage });
      }

      // Log webhook
      await supabase.from("rd_station_webhook_logs").insert({
        organization_id: orgId,
        event_type: payload.event_type || "conversion",
        payload: leadData,
        lead_id: leadId,
        status,
        error_message: errorMessage,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("RD Station webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractConversionIdentifier(data: Record<string, any>): string | null {
  // Try last_conversion first (most recent), then first_conversion
  if (data.last_conversion) {
    const content = data.last_conversion.content || data.last_conversion;
    const id = content.identifier || content.conversion_identifier;
    if (id) return id;
  }
  if (data.first_conversion) {
    const content = data.first_conversion.content || data.first_conversion;
    const id = content.identifier || content.conversion_identifier;
    if (id) return id;
  }
  if (data.conversion_identifier) return data.conversion_identifier;
  return null;
}

async function matchProperty(
  supabase: any,
  orgId: string,
  contact: Record<string, any>
): Promise<string | null> {
  try {
    const hints: string[] = [];

    const extractConversionId = (conv: any) => {
      if (!conv) return;
      const content = conv.content || conv;
      const id = content.identifier || content.conversion_identifier;
      if (id) hints.push(id);
    };
    extractConversionId(contact.first_conversion);
    extractConversionId(contact.last_conversion);
    if (contact.conversion_identifier) hints.push(contact.conversion_identifier);

    if (Array.isArray(contact.tags)) {
      hints.push(...contact.tags.filter((t: any) => typeof t === "string"));
    }

    if (contact.custom_fields && typeof contact.custom_fields === "object") {
      for (const [key, value] of Object.entries(contact.custom_fields)) {
        if (value && typeof value === "string" && /imovel|imóvel|property|empreendimento|lote|casa|apto|apartamento|loteamento/i.test(key)) {
          hints.push(value);
        }
      }
    }

    if (contact.cf_imovel_interesse) hints.push(contact.cf_imovel_interesse);
    if (contact.cf_empreendimento) hints.push(contact.cf_empreendimento);

    if (hints.length === 0) return null;

    const { data: properties } = await supabase
      .from("properties")
      .select("id, title, property_code")
      .eq("organization_id", orgId)
      .limit(500);

    if (!properties || properties.length === 0) return null;

    for (const hint of hints) {
      const normalized = hint.trim().toLowerCase();
      for (const prop of properties) {
        if (prop.property_code && prop.property_code.toLowerCase() === normalized) {
          return prop.id;
        }
      }
    }

    for (const hint of hints) {
      const normalized = hint.toLowerCase();
      for (const prop of properties) {
        if (prop.property_code && normalized.includes(prop.property_code.toLowerCase())) {
          return prop.id;
        }
      }
    }

    for (const hint of hints) {
      const normalized = hint.toLowerCase();
      if (normalized.length < 3) continue;
      for (const prop of properties) {
        const title = (prop.title || "").toLowerCase();
        if (title.length < 3) continue;
        if (normalized.includes(title) || title.includes(normalized)) {
          return prop.id;
        }
      }
    }

    return null;
  } catch (err) {
    console.error("matchProperty error:", err);
    return null;
  }
}

function buildNotes(data: Record<string, any>): string {
  const ignore = new Set([
    "id", "name", "nome", "email", "phone", "telefone",
    "personal_phone", "mobile_phone", "personal_email",
    "first_name", "last_name", "traffic_source",
    "conversion_identifier",
  ]);
  const lines: string[] = [];

  // Extract conversion events
  if (data.first_conversion && typeof data.first_conversion === "object") {
    const fc = data.first_conversion;
    const fcContent = fc.content || fc;
    lines.push(`Primeira conversão: ${fcContent.identifier || fcContent.conversion_identifier || JSON.stringify(fcContent)}`);
    if (fc.source || fcContent.source) lines.push(`  Origem: ${fc.source || fcContent.source}`);
    if (fc.created_at || fcContent.created_at) lines.push(`  Data: ${fc.created_at || fcContent.created_at}`);
  }
  if (data.last_conversion && typeof data.last_conversion === "object") {
    const lc = data.last_conversion;
    const lcContent = lc.content || lc;
    const lcId = lcContent.identifier || lcContent.conversion_identifier || JSON.stringify(lcContent);
    // Avoid duplicating if same as first
    const fcId = data.first_conversion?.content?.identifier || data.first_conversion?.conversion_identifier;
    if (lcId !== fcId) {
      lines.push(`Última conversão: ${lcId}`);
      if (lc.source || lcContent.source) lines.push(`  Origem: ${lc.source || lcContent.source}`);
      if (lc.created_at || lcContent.created_at) lines.push(`  Data: ${lc.created_at || lcContent.created_at}`);
    }
  }

  // Extract custom fields
  if (data.custom_fields && typeof data.custom_fields === "object") {
    for (const [key, value] of Object.entries(data.custom_fields)) {
      if (value != null && value !== "") {
        lines.push(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
      }
    }
  }

  // Extract other useful fields
  if (data.lead_stage) lines.push(`Estágio no funil: ${data.lead_stage}`);
  if (data.number_conversions) lines.push(`Nº conversões: ${data.number_conversions}`);
  if (data.public_url) lines.push(`URL RD Station: ${data.public_url}`);
  if (data.opportunity === true) lines.push(`Oportunidade: Sim`);
  if (data.company) lines.push(`Empresa: ${data.company}`);
  if (data.job_title) lines.push(`Cargo: ${data.job_title}`);
  if (data.city) lines.push(`Cidade: ${data.city}`);
  if (data.state) lines.push(`Estado: ${data.state}`);
  if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) lines.push(`Tags: ${data.tags.join(", ")}`);

  // Remaining simple fields
  const handled = new Set([
    ...ignore, "first_conversion", "last_conversion", "custom_fields", "lead_stage",
    "number_conversions", "public_url", "uuid", "opportunity", "company",
    "job_title", "city", "state", "tags", "created_at",
  ]);
  for (const [key, value] of Object.entries(data)) {
    if (handled.has(key) || value == null || value === "" || typeof value === "object") continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.length > 0
    ? `[RD Station]\n${lines.join("\n")}`
    : "[Importado via RD Station]";
}
