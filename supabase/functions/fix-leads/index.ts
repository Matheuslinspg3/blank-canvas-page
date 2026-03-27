import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.organization_id;

    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { /* empty */ }

    const source = body.source; // "rdstation" | "meta_ads" | "all"

    // 1. Fetch all leads for this org
    const query = supabase
      .from("leads")
      .select("id, name, email, phone, source, external_source, external_id, conversion_identifier, traffic_source, notes, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (source === "rdstation") {
      query.eq("external_source", "rdstation");
    } else if (source === "meta_ads") {
      query.eq("external_source", "meta_ads");
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum lead encontrado.", enriched: 0, fixed: 0, merged: 0, source_updated: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixed = 0;
    let merged = 0;
    let sourceUpdated = 0;
    let enriched = 0;

    // ── STEP 1: Enrich RD Station leads via API ──
    // Get RD Station OAuth token for this org
    let rdAccessToken: string | null = null;
    if (source === "rdstation" || source === "all" || !source) {
      const { data: rdSettings } = await supabase
        .from("rd_station_settings")
        .select("oauth_access_token, oauth_refresh_token, oauth_token_expires_at, organization_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .maybeSingle();

      if (rdSettings?.oauth_access_token) {
        rdAccessToken = rdSettings.oauth_access_token;

        // Refresh if expired
        if (rdSettings.oauth_token_expires_at && new Date(rdSettings.oauth_token_expires_at) < new Date()) {
          const refreshed = await refreshRDToken(supabase, rdSettings, orgId);
          if (refreshed) rdAccessToken = refreshed;
          else rdAccessToken = null;
        }
      }
    }

    // Enrich RD Station leads that have a UUID but missing data
    if (rdAccessToken) {
      const rdLeads = leads.filter(l =>
        l.external_source === "rdstation" &&
        l.external_id &&
        (!l.conversion_identifier || !l.traffic_source || !l.phone)
      );

      console.log(`[fix-leads] Enriching ${rdLeads.length} RD Station leads via API...`);

      for (const lead of rdLeads) {
        try {
          const contact = await fetchRDContact(lead.external_id!, rdAccessToken);
          if (!contact) continue;

          const updateData: Record<string, any> = {};

          // Fill conversion_identifier
          if (!lead.conversion_identifier) {
            const convId = extractConversionIdentifier(contact);
            if (convId) updateData.conversion_identifier = convId;
          }

          // Fill traffic_source
          if (!lead.traffic_source) {
            const tSrc = extractTrafficSource(contact);
            if (tSrc) updateData.traffic_source = tSrc;
          }

          // Fill phone
          if (!lead.phone) {
            const phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhoneFromCustomFields(contact);
            if (phone) updateData.phone = phone;
          }

          // Fill name if generic
          if (lead.name === "Lead RD Station" || !lead.name) {
            const name = contact.name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
            if (name && name !== "Lead RD Station") updateData.name = name;
          }

          // Fill email
          if (!lead.email && contact.email) {
            updateData.email = contact.email;
          }

          // Rebuild notes with full data
          const newNotes = buildNotes(contact);
          if (newNotes && newNotes.length > (lead.notes || "").length) {
            updateData.notes = newNotes;
          }

          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase.from("leads").update(updateData).eq("id", lead.id);
            if (!error) {
              enriched++;
              // Update in-memory lead for subsequent merge logic
              Object.assign(lead, updateData);
            }
          }

          // Rate limit: 200ms between API calls
          await sleep(200);
        } catch (err: any) {
          console.error(`[fix-leads] Error enriching lead ${lead.id}:`, err.message);
        }
      }
    }

    // ── STEP 2: Fix source/external_source and extract from notes ──
    for (const lead of leads) {
      const updateData: Record<string, any> = {};

      // Fix external_source based on source text
      if (!lead.external_source) {
        if (lead.source && /rd\s*station/i.test(lead.source)) {
          updateData.external_source = "rdstation";
        } else if (lead.source && /meta|facebook|instagram/i.test(lead.source)) {
          updateData.external_source = "meta_ads";
        }
      }

      // Fix source text
      if (lead.external_source === "rdstation" && !lead.source) {
        updateData.source = "RD Station";
      }
      if (lead.external_source === "meta_ads" && !lead.source) {
        updateData.source = "Meta Ads";
      }

      // Extract conversion_identifier from notes if still missing
      if (!lead.conversion_identifier && lead.notes) {
        const match = lead.notes.match(/Anúncio\/Formulário:\s*(.+)/);
        if (match) updateData.conversion_identifier = match[1].trim();
      }

      // Extract traffic_source from notes if still missing
      if (!lead.traffic_source && lead.notes) {
        const match = lead.notes.match(/Origem do tráfego:\s*(.+)/);
        if (match) {
          updateData.traffic_source = match[1].trim();
        } else {
          const match2 = lead.notes.match(/Origem:\s*(.+)/);
          if (match2) updateData.traffic_source = match2[1].trim();
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from("leads").update(updateData).eq("id", lead.id);
        if (!error) {
          if (updateData.external_source) sourceUpdated++;
          if (updateData.conversion_identifier || updateData.traffic_source) fixed++;
          Object.assign(lead, updateData);
        }
      }
    }

    // ── STEP 3: Merge duplicates ──
    const byEmail: Record<string, typeof leads> = {};
    const byPhone: Record<string, typeof leads> = {};

    for (const lead of leads) {
      if (lead.email) {
        const key = lead.email.toLowerCase().trim();
        if (!byEmail[key]) byEmail[key] = [];
        byEmail[key].push(lead);
      }
      if (lead.phone) {
        const digits = lead.phone.replace(/\D/g, "");
        if (digits.length >= 8) {
          const key = digits.slice(-8);
          if (!byPhone[key]) byPhone[key] = [];
          byPhone[key].push(lead);
        }
      }
    }

    const mergedIds = new Set<string>();

    // Merge email duplicates
    for (const [_, group] of Object.entries(byEmail)) {
      if (group.length <= 1) continue;
      const keeper = group[group.length - 1];
      for (let i = 0; i < group.length - 1; i++) {
        const dup = group[i];
        if (mergedIds.has(dup.id) || dup.id === keeper.id) continue;

        const updateData: Record<string, any> = {};
        if (!keeper.phone && dup.phone) updateData.phone = dup.phone;
        if (!keeper.conversion_identifier && dup.conversion_identifier) updateData.conversion_identifier = dup.conversion_identifier;
        if (!keeper.traffic_source && dup.traffic_source) updateData.traffic_source = dup.traffic_source;
        if (!keeper.external_id && dup.external_id) updateData.external_id = dup.external_id;
        if (!keeper.external_source && dup.external_source) updateData.external_source = dup.external_source;

        if (Object.keys(updateData).length > 0) {
          await supabase.from("leads").update(updateData).eq("id", keeper.id);
          Object.assign(keeper, updateData);
        }

        await supabase.from("leads").update({ is_active: false, notes: `${dup.notes || ""}\n[Mesclado com lead ${keeper.id}]`.trim() }).eq("id", dup.id);
        await supabase.from("lead_interactions").update({ lead_id: keeper.id }).eq("lead_id", dup.id);

        mergedIds.add(dup.id);
        merged++;
      }
    }

    // Merge phone duplicates
    for (const [_, group] of Object.entries(byPhone)) {
      const active = group.filter(l => !mergedIds.has(l.id));
      if (active.length <= 1) continue;

      const keeper = active[active.length - 1];
      for (let i = 0; i < active.length - 1; i++) {
        const dup = active[i];
        if (mergedIds.has(dup.id) || dup.id === keeper.id) continue;
        if (keeper.email && dup.email && keeper.email.toLowerCase() !== dup.email.toLowerCase()) continue;

        const updateData: Record<string, any> = {};
        if (!keeper.email && dup.email) updateData.email = dup.email;
        if (!keeper.conversion_identifier && dup.conversion_identifier) updateData.conversion_identifier = dup.conversion_identifier;
        if (!keeper.traffic_source && dup.traffic_source) updateData.traffic_source = dup.traffic_source;
        if (!keeper.external_id && dup.external_id) updateData.external_id = dup.external_id;
        if (!keeper.external_source && dup.external_source) updateData.external_source = dup.external_source;

        if (Object.keys(updateData).length > 0) {
          await supabase.from("leads").update(updateData).eq("id", keeper.id);
          Object.assign(keeper, updateData);
        }

        await supabase.from("leads").update({ is_active: false, notes: `${dup.notes || ""}\n[Mesclado com lead ${keeper.id}]`.trim() }).eq("id", dup.id);
        await supabase.from("lead_interactions").update({ lead_id: keeper.id }).eq("lead_id", dup.id);

        mergedIds.add(dup.id);
        merged++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, enriched, fixed, merged, source_updated: sourceUpdated, total_analyzed: leads.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fix-leads error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── RD Station API helpers ──

async function fetchRDContact(uuid: string, accessToken: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`https://api.rd.services/platform/contacts/${uuid}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.log(`[fix-leads] RD API ${res.status} for ${uuid}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.log(`[fix-leads] RD fetch error for ${uuid}: ${err.message}`);
    return null;
  }
}

async function refreshRDToken(supabase: any, settings: any, orgId: string): Promise<string | null> {
  try {
    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");
    if (!clientId || !clientSecret || !settings.oauth_refresh_token) return null;

    const res = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.oauth_refresh_token,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString();

    await supabase.from("rd_station_settings").update({
      oauth_access_token: data.access_token,
      oauth_refresh_token: data.refresh_token || settings.oauth_refresh_token,
      oauth_token_expires_at: expiresAt,
    }).eq("organization_id", orgId);

    return data.access_token;
  } catch (err: any) {
    console.error("RD token refresh error:", err);
    return null;
  }
}

function extractConversionIdentifier(data: Record<string, any>): string | null {
  const extractId = (conv: any): string | null => {
    if (!conv) return null;
    const content = conv.content || conv;
    return content.identifier || content.identificador || content.conversion_identifier || content.event_identifier || null;
  };
  return extractId(data.last_conversion) || extractId(data.first_conversion) || data.conversion_identifier || null;
}

function extractTrafficSource(data: Record<string, any>): string | null {
  if (data.traffic_source) return data.traffic_source;
  for (const conv of [data.last_conversion, data.first_conversion]) {
    if (!conv) continue;
    const content = conv.content || conv;
    if (conv.source) return conv.source;
    if (content.source) return content.source;
    if (content.traffic_source) return content.traffic_source;
  }
  return null;
}

function extractPhoneFromCustomFields(contact: any): string | null {
  if (contact.custom_fields && typeof contact.custom_fields === "object") {
    for (const [key, value] of Object.entries(contact.custom_fields)) {
      if (value && typeof value === "string" && /phone|telefone|celular|whatsapp|fone/i.test(key)) {
        const digits = value.replace(/\D/g, "");
        if (digits.length >= 8) return value;
      }
    }
  }
  return null;
}

function buildNotes(data: Record<string, any>): string {
  const lines: string[] = [];

  const convId = extractConversionIdentifier(data);
  if (convId) lines.push(`Anúncio/Formulário: ${convId}`);

  const trafficSrc = extractTrafficSource(data);
  if (trafficSrc) lines.push(`Origem do tráfego: ${trafficSrc}`);

  if (data.first_conversion && typeof data.first_conversion === "object") {
    const fc = data.first_conversion;
    const fcContent = fc.content || fc;
    const fcId = fcContent.identifier || fcContent.identificador || fcContent.conversion_identifier || JSON.stringify(fcContent);
    lines.push(`Primeira conversão: ${fcId}`);
    if (fc.source || fcContent.source) lines.push(`  Origem: ${fc.source || fcContent.source}`);
    if (fc.created_at || fcContent.created_at) lines.push(`  Data: ${fc.created_at || fcContent.created_at}`);
  }
  if (data.last_conversion && typeof data.last_conversion === "object") {
    const lc = data.last_conversion;
    const lcContent = lc.content || lc;
    const lcId = lcContent.identifier || lcContent.identificador || lcContent.conversion_identifier || JSON.stringify(lcContent);
    const fcId = extractConversionIdentifier({ first_conversion: data.first_conversion });
    if (lcId !== fcId) {
      lines.push(`Última conversão: ${lcId}`);
      if (lc.source || lcContent.source) lines.push(`  Origem: ${lc.source || lcContent.source}`);
      if (lc.created_at || lcContent.created_at) lines.push(`  Data: ${lc.created_at || lcContent.created_at}`);
    }
  }

  if (data.custom_fields && typeof data.custom_fields === "object") {
    for (const [key, value] of Object.entries(data.custom_fields)) {
      if (value != null && value !== "") {
        lines.push(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
      }
    }
  }

  if (data.lead_stage) lines.push(`Estágio no funil: ${data.lead_stage}`);
  if (data.company) lines.push(`Empresa: ${data.company}`);
  if (data.job_title) lines.push(`Cargo: ${data.job_title}`);
  if (data.city) lines.push(`Cidade: ${data.city}`);
  if (data.state) lines.push(`Estado: ${data.state}`);
  if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) lines.push(`Tags: ${data.tags.join(", ")}`);
  if (data.uuid) lines.push(`RD UUID: ${data.uuid}`);

  return lines.length > 0 ? `[RD Station]\n${lines.join("\n")}` : "[RD Station] Lead corrigido";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
