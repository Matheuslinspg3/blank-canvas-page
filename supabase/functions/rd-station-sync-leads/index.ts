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
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { /* empty body is ok */ }

    const isAutoSync = body?.auto_sync === true;
    const isSelective = body?.selective === true;

    if (isAutoSync) {
      return await handleAutoSync(supabase);
    } else if (isSelective) {
      return await handleSelectiveSync(req, supabase, body);
    } else {
      return await handleManualSync(req, supabase);
    }
  } catch (err: any) {
    console.error("RD Station sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── AUTO SYNC: called by pg_cron, iterates all orgs with active OAuth ───

async function handleAutoSync(supabase: any): Promise<Response> {
  console.log("[auto_sync] Starting auto sync for all orgs...");

  const { data: allSettings, error: settingsErr } = await supabase
    .from("rd_station_settings")
    .select("*, organization_id")
    .eq("is_active", true)
    .not("oauth_access_token", "is", null);

  if (settingsErr || !allSettings?.length) {
    console.log("[auto_sync] No active orgs with OAuth:", settingsErr?.message || "0 orgs");
    return new Response(
      JSON.stringify({ success: true, message: "No orgs to sync", orgs_processed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: any[] = [];

  for (const settings of allSettings) {
    const orgId = settings.organization_id;
    try {
      // Get the org admin user_id for created_by
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId)
        .limit(1)
        .single();

      if (!adminProfile) {
        results.push({ org: orgId, error: "No profile found" });
        continue;
      }

      const syncResult = await syncOrgContacts(supabase, settings, orgId, adminProfile.user_id, { skipDuplicateLog: true });
      results.push({ org: orgId, ...syncResult });

      // Update last_sync_at
      await supabase
        .from("rd_station_settings")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("organization_id", orgId);

      // Small delay between orgs to avoid rate limiting
      await sleep(1000);
    } catch (orgErr: any) {
      console.error(`[auto_sync] Error for org ${orgId}:`, orgErr);
      results.push({ org: orgId, error: orgErr.message });
    }
  }

  console.log(`[auto_sync] Completed. Processed ${results.length} orgs.`);

  return new Response(
    JSON.stringify({ success: true, orgs_processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── MANUAL SYNC: called by user from the UI ───

async function handleManualSync(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, user_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) {
    return new Response(JSON.stringify({ error: "No organization" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = profile.organization_id;

  const { data: settings } = await supabase
    .from("rd_station_settings")
    .select("*")
    .eq("organization_id", orgId)
    .single();

  if (!settings) {
    return new Response(
      JSON.stringify({ error: "Configurações do RD Station não encontradas." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!settings.is_active) {
    return new Response(
      JSON.stringify({ error: "Integração RD Station está inativa." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!settings.oauth_access_token) {
    return new Response(
      JSON.stringify({ error: "Conexão OAuth não configurada.", needs_oauth: true }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const syncResult = await syncOrgContacts(supabase, settings, orgId, profile.user_id);

  if (syncResult.error) {
    return new Response(JSON.stringify(syncResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update last_sync_at
  await supabase
    .from("rd_station_settings")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  return new Response(JSON.stringify({ success: true, ...syncResult }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── SELECTIVE SYNC: import specific contacts chosen by user ───

async function handleSelectiveSync(req: Request, supabase: any, body: Record<string, any>): Promise<Response> {
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
    .select("organization_id, user_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) {
    return new Response(JSON.stringify({ error: "No organization" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = profile.organization_id;
  const contactUuids: string[] = body.contact_uuids || [];
  const mergeExisting = body.merge_existing === true;

  if (contactUuids.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum contato selecionado." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: settings } = await supabase
    .from("rd_station_settings")
    .select("*")
    .eq("organization_id", orgId)
    .single();

  if (!settings?.oauth_access_token) {
    return new Response(
      JSON.stringify({ error: "OAuth não configurado.", needs_oauth: true }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let accessToken = settings.oauth_access_token;
  if (settings.oauth_token_expires_at && new Date(settings.oauth_token_expires_at) < new Date()) {
    const refreshResult = await refreshToken(supabase, settings, orgId);
    if (refreshResult.error) {
      return new Response(JSON.stringify({ error: "Token expirado.", needs_oauth: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = refreshResult.access_token!;
  }

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  // Fetch segmentations to get contacts
  const segRes = await fetchWithTimeout("https://api.rd.services/platform/segmentations", apiHeaders, 15000);
  if (!segRes.ok) {
    return new Response(JSON.stringify({ error: `Erro segmentações (${segRes.status})` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const segData = await segRes.json();
  const segmentations = segData?.segmentations || [];
  const targetSegId = settings.rd_segmentation_id || null;
  let segmentation = targetSegId
    ? segmentations.find((s: any) => String(s.id) === String(targetSegId))
    : null;
  if (!segmentation) {
    segmentation =
      segmentations.find((s: any) => s.name === "Leads (estágio no funil)") ||
      segmentations.find((s: any) => s.name?.includes("Todos os contatos")) ||
      segmentations[0];
  }
  if (!segmentation) {
    return new Response(JSON.stringify({ error: "Nenhuma segmentação encontrada." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch all contacts to find selected ones
  const uuidSet = new Set(contactUuids);
  const selectedContacts: any[] = [];
  let page = 1;
  const pageSize = 125;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const url = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
    const res = await fetchWithTimeout(url, apiHeaders, 15000);
    if (!res.ok) break;
    const data = await res.json();
    const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);
    if (contacts.length === 0) break;

    for (const c of contacts) {
      if (c.uuid && uuidSet.has(c.uuid)) {
        selectedContacts.push(c);
        uuidSet.delete(c.uuid);
      }
    }

    if (uuidSet.size === 0) break;
    hasMore = typeof data?.has_more === "boolean" ? data.has_more : contacts.length >= pageSize;
    page++;
  }

  // Process selected contacts
  let created = 0;
  let updated = 0;
  let duplicates = 0;
  let errors = 0;

  for (const rawContact of selectedContacts) {
    try {
      let contact = rawContact;
      const email = contact.email || null;
      const name = contact.name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Lead RD Station";
      let phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhoneFromCustomFields(contact) || null;

      // If no phone and we have uuid, fetch full contact details
      if (!phone && contact.uuid) {
        const fullContact = await fetchFullContactDetails(contact.uuid, apiHeaders);
        if (fullContact) {
          contact = { ...contact, ...fullContact };
          phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhoneFromCustomFields(contact) || null;
        }
        await sleep(200);
      }
      const notes = buildNotes(contact);

      let existingLead: any = null;

      if (contact.uuid) {
        const { data: byExtId } = await supabase
          .from("leads").select("id").eq("organization_id", orgId)
          .eq("external_id", contact.uuid).maybeSingle();
        if (byExtId) existingLead = byExtId;
      }

      if (!existingLead && email) {
        const { data: byEmail } = await supabase
          .from("leads").select("id").eq("organization_id", orgId)
          .eq("email", email).maybeSingle();
        if (byEmail) existingLead = byEmail;
      }

      if (!existingLead && phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        if (normalizedPhone.length >= 8) {
          const { data: allLeads } = await supabase
            .from("leads").select("id, phone").eq("organization_id", orgId)
            .not("phone", "is", null);
          const match = (allLeads || []).find((l: any) => {
            const lPhone = (l.phone || "").replace(/\D/g, "");
            return lPhone.length >= 8 && (lPhone === normalizedPhone || lPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(lPhone));
          });
          if (match) existingLead = match;
        }
      }

      if (existingLead && mergeExisting) {
        const updateData: Record<string, any> = {};
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (notes) updateData.notes = notes;
        updateData.external_id = contact.uuid || undefined;
        updateData.external_source = "rdstation";
        await supabase.from("leads").update(updateData).eq("id", existingLead.id);
        updated++;
      } else if (existingLead) {
        duplicates++;
      } else {
        const source = settings.default_source || "RD Station";
        const propertyId = await matchProperty(supabase, orgId, contact);
        const { error: insertError } = await supabase.from("leads").insert({
          organization_id: orgId, name, email, phone, source,
          lead_stage_id: settings.default_stage_id,
          created_by: profile.user_id,
          external_id: contact.uuid || null,
          external_source: "rdstation",
          notes,
          property_id: propertyId,
        });
        if (insertError) errors++;
        else created++;
      }
    } catch { errors++; }
  }

  await supabase.from("rd_station_settings")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  return new Response(
    JSON.stringify({ success: true, created, updated, duplicates, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── CORE SYNC LOGIC (shared between manual and auto) ───

async function syncOrgContacts(
  supabase: any,
  settings: any,
  orgId: string,
  userId: string,
  options?: { skipDuplicateLog?: boolean }
): Promise<Record<string, any>> {
  let accessToken = settings.oauth_access_token;

  // Check if token is expired and try to refresh
  if (settings.oauth_token_expires_at) {
    const expiresAt = new Date(settings.oauth_token_expires_at);
    if (expiresAt < new Date()) {
      const refreshResult = await refreshToken(supabase, settings, orgId);
      if (refreshResult.error) {
        return { error: "Token OAuth expirado.", needs_oauth: true };
      }
      accessToken = refreshResult.access_token!;
    }
  }

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": "Habitae-RD-Sync/1.0",
  };

  // Step 1: Get segmentations
  let segRes = await fetchWithTimeout(
    "https://api.rd.services/platform/segmentations",
    apiHeaders,
    15000
  );

  // Handle 401 with token refresh
  if (segRes.status === 401) {
    const refreshResult = await refreshToken(supabase, settings, orgId);
    if (refreshResult.error) {
      return { error: "Token OAuth inválido.", needs_oauth: true };
    }
    accessToken = refreshResult.access_token!;
    apiHeaders.Authorization = `Bearer ${accessToken}`;
    segRes = await fetchWithTimeout(
      "https://api.rd.services/platform/segmentations",
      apiHeaders,
      15000
    );
  }

  if (!segRes.ok) {
    return { error: `Erro ao listar segmentações (${segRes.status}).` };
  }

  const segData = await segRes.json();
  const segmentations = segData?.segmentations || [];

  // Find target segmentation
  const targetSegId = settings.rd_segmentation_id || null;
  let segmentation = targetSegId
    ? segmentations.find((s: any) => String(s.id) === String(targetSegId))
    : null;

  if (!segmentation) {
    segmentation =
      segmentations.find((s: any) => s.name === "Leads (estágio no funil)") ||
      segmentations.find((s: any) => s.name?.includes("Todos os contatos")) ||
      segmentations[0];
  }

  if (!segmentation) {
    return { error: "Nenhuma segmentação encontrada no RD Station." };
  }

  console.log(`[sync] Org ${orgId}: Using segmentation "${segmentation.name}" (ID: ${segmentation.id})`);

  // Step 2: Paginate contacts
  let created = 0;
  let duplicates = 0;
  let errors = 0;
  let page = 1;
  const pageSize = 125;
  const maxPages = 10;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const contactsUrl = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
    const contactsRes = await fetchWithTimeout(contactsUrl, apiHeaders, 15000);

    if (contactsRes.status === 401) {
      const refreshResult = await refreshToken(supabase, settings, orgId);
      if (refreshResult.error) {
        return { error: "Token expirado durante sync.", needs_oauth: true, partial: { created, duplicates, errors } };
      }
      accessToken = refreshResult.access_token!;
      apiHeaders.Authorization = `Bearer ${accessToken}`;
      continue;
    }

    if (contactsRes.status === 429) {
      return {
        error: "Limite de requisições atingido.",
        partial: { created, duplicates, errors, pages_processed: page },
      };
    }

    if (!contactsRes.ok) {
      const errText = await contactsRes.text();
      return {
        error: `Erro na API (${contactsRes.status}).`,
        summary: summarizeRdError(errText),
      };
    }

    const data = await contactsRes.json();
    const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);

    if (contacts.length === 0) {
      hasMore = false;
      break;
    }

    const result = await processContacts(supabase, contacts, orgId, settings, userId, {
      created, duplicates, errors,
    }, options, apiHeaders);
    created = result.created;
    duplicates = result.duplicates;
    errors = result.errors;

    if (typeof data?.has_more === "boolean") {
      hasMore = data.has_more;
      if (hasMore) page++;
    } else if (contacts.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return {
    created,
    duplicates,
    errors,
    pages_processed: page,
    segmentation_name: segmentation.name,
  };
}

// ─── HELPER FUNCTIONS ───

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") {
      return new Response("Timeout", { status: 504 });
    }
    throw err;
  }
}

function summarizeRdError(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 220);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshToken(
  supabase: any,
  settings: any,
  orgId: string
): Promise<{ error?: string; access_token?: string }> {
  try {
    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");

    if (!clientId || !clientSecret || !settings.oauth_refresh_token) {
      return { error: "Missing OAuth credentials for refresh" };
    }

    const res = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.oauth_refresh_token,
      }),
    });

    if (!res.ok) {
      return { error: `Refresh failed: ${res.status}` };
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const expiresIn = data.expires_in || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase
      .from("rd_station_settings")
      .update({
        oauth_access_token: newAccessToken,
        oauth_refresh_token: newRefreshToken || settings.oauth_refresh_token,
        oauth_token_expires_at: expiresAt,
      })
      .eq("organization_id", orgId);

    return { access_token: newAccessToken };
  } catch (err: any) {
    console.error("OAuth refresh error:", err);
    return { error: err.message };
  }
}

// ─── FETCH FULL CONTACT DETAILS from /platform/contacts/{uuid} ───

async function fetchFullContactDetails(
  uuid: string,
  apiHeaders: Record<string, string>
): Promise<Record<string, any> | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.rd.services/platform/contacts/${uuid}`,
      apiHeaders,
      10000
    );
    if (!res.ok) {
      console.log(`[fetchFull] Failed for ${uuid}: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.log(`[fetchFull] Error for ${uuid}: ${err.message}`);
    return null;
  }
}

async function processContacts(
  supabase: any,
  contacts: any[],
  orgId: string,
  settings: any,
  userId: string,
  counters: { created: number; duplicates: number; errors: number },
  options?: { skipDuplicateLog?: boolean },
  apiHeaders?: Record<string, string>
) {
  let { created, duplicates, errors } = counters;

  for (const rawContact of contacts) {
    try {
      let contact = rawContact;
      let phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhoneFromCustomFields(contact) || null;

      // ALWAYS fetch full contact details — the segmentation endpoint returns very limited data
      if (contact.uuid && apiHeaders) {
        const fullContact = await fetchFullContactDetails(contact.uuid, apiHeaders);
        if (fullContact) {
          contact = { ...contact, ...fullContact };
          phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhoneFromCustomFields(contact) || null;
        }
        await sleep(200);
      }

      const email = contact.email || null;
      const name =
        contact.name ||
        `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
        "Lead RD Station";

      // Check duplicate by email
      if (email) {
        const { data: existingByEmail } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", orgId)
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        if (existingByEmail) {
          // Update existing lead with missing data (phone, external_id, notes, conversion)
          const updateData: Record<string, any> = {};
          if (phone) updateData.phone = phone;
          if (contact.uuid) {
            updateData.external_id = contact.uuid;
            updateData.external_source = "rdstation";
          }
          const notes = buildNotes(contact);
          if (notes && notes !== "[Sincronizado via RD Station API]") updateData.notes = notes;
          const convId = extractConversionIdentifier(contact);
          if (convId) updateData.conversion_identifier = convId;
          const tSrc = extractTrafficSource(contact);
          if (tSrc) updateData.traffic_source = tSrc;
          if (Object.keys(updateData).length > 0) {
            await supabase.from("leads").update(updateData).eq("id", existingByEmail.id);
          }
          // Import activities for existing lead too
          if (contact.uuid && apiHeaders) {
            await importContactEvents(supabase, contact.uuid, existingByEmail.id, orgId, userId, apiHeaders);
            await sleep(200);
          }
          duplicates++;
          continue;
        }
      }

      // Check duplicate by phone (normalized, digits only, min 8 chars)
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        if (normalizedPhone.length >= 8) {
          const { data: existingLeads } = await supabase
            .from("leads")
            .select("id, phone")
            .eq("organization_id", orgId)
            .not("phone", "is", null);

          const phoneMatch = (existingLeads || []).find((l: any) => {
            const lPhone = (l.phone || "").replace(/\D/g, "");
            return lPhone.length >= 8 && (
              lPhone === normalizedPhone ||
              lPhone.endsWith(normalizedPhone) ||
              normalizedPhone.endsWith(lPhone)
            );
          });

          if (phoneMatch) {
            // Update existing lead with missing data
            const updateData: Record<string, any> = {};
            if (email) updateData.email = email;
            if (contact.uuid) {
              updateData.external_id = contact.uuid;
              updateData.external_source = "rdstation";
            }
            const notes = buildNotes(contact);
            if (notes && notes !== "[Sincronizado via RD Station API]") updateData.notes = notes;
            const convId = extractConversionIdentifier(contact);
            if (convId) updateData.conversion_identifier = convId;
            const tSrc = extractTrafficSource(contact);
            if (tSrc) updateData.traffic_source = tSrc;
            if (Object.keys(updateData).length > 0) {
              await supabase.from("leads").update(updateData).eq("id", phoneMatch.id);
            }
            // Import activities for existing lead
            if (contact.uuid && apiHeaders) {
              await importContactEvents(supabase, contact.uuid, phoneMatch.id, orgId, userId, apiHeaders);
              await sleep(200);
            }
            duplicates++;
            continue;
          }
        }
      }

      if (settings.auto_send_to_crm) {
        const source = settings.default_source || "RD Station";
        const notes = buildNotes(contact);
        const propertyId = await matchProperty(supabase, orgId, contact);
        const conversionId = extractConversionIdentifier(contact);
        const trafficSource = extractTrafficSource(contact);

        const { data: newLead, error: insertError } = await supabase
          .from("leads")
          .insert({
            organization_id: orgId,
            name,
            email,
            phone,
            source,
            lead_stage_id: settings.default_stage_id,
            created_by: userId,
            external_id: contact.uuid || null,
            external_source: "rdstation",
            notes,
            property_id: propertyId,
            conversion_identifier: conversionId,
            traffic_source: trafficSource,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Insert lead error:", insertError);
          errors++;
          await supabase.from("rd_station_webhook_logs").insert({
            organization_id: orgId,
            event_type: "api_sync",
            payload: { name, email, phone },
            status: "error",
            error_message: insertError.message,
          });
          continue;
        }

        created++;

        // Import activities/events from RD Station
        if (newLead?.id && contact.uuid && apiHeaders) {
          await importContactEvents(supabase, contact.uuid, newLead.id, orgId, userId, apiHeaders);
          await sleep(200);
        }

        // Notify org managers about new RD Station lead
        if (newLead?.id) {
          const { data: managers } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "sub_admin"]);

          for (const mgr of (managers || [])) {
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
                p_message: `O lead "${name}" foi sincronizado do RD Station.`,
                p_entity_id: newLead.id,
                p_entity_type: "lead",
              });
            }
          }
        }

        await supabase.from("rd_station_webhook_logs").insert({
          organization_id: orgId,
          event_type: "api_sync",
          payload: { name, email, phone, rd_uuid: contact.uuid },
          lead_id: newLead?.id,
          status: "created",
        });
      } else {
        await supabase.from("rd_station_webhook_logs").insert({
          organization_id: orgId,
          event_type: "api_sync",
          payload: { name, email, phone, rd_uuid: contact.uuid },
          status: "received_not_sent",
        });
        created++;
      }
    } catch (contactErr: any) {
      console.error("Contact processing error:", contactErr);
      errors++;
    }
  }

  return { created, duplicates, errors };
}

// ─── IMPORT CONTACT EVENTS from /platform/contacts/{uuid}/events ───

async function importContactEvents(
  supabase: any,
  uuid: string,
  leadId: string,
  orgId: string,
  userId: string,
  apiHeaders: Record<string, string>
): Promise<void> {
  try {
    const res = await fetchWithTimeout(
      `https://api.rd.services/platform/contacts/${uuid}/events`,
      apiHeaders,
      10000
    );
    if (!res.ok) {
      console.log(`[events] Failed for ${uuid}: ${res.status}`);
      return;
    }
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : (Array.isArray(data) ? data : []);

    if (events.length === 0) return;

    const interactionTypeMap: Record<string, string> = {
      "CONVERSION": "nota",
      "OPPORTUNITY": "nota",
      "SALE": "nota",
      "OPPORTUNITY_LOST": "nota",
      "EMAIL": "email",
      "EMAIL_CLICK": "email",
      "EMAIL_OPEN": "email",
      "CHAT": "whatsapp",
      "CALL": "ligacao",
      "MEDIA": "nota",
    };

    for (const event of events.slice(0, 50)) {
      const eventType = event.event_type || event.type || "CONVERSION";
      const interactionType = interactionTypeMap[eventType] || "nota";
      const occurredAt = event.event_timestamp || event.created_at || new Date().toISOString();

      let description = `[RD Station] ${eventType}`;
      if (event.event_identifier || event.conversion_identifier) {
        description += `: ${event.event_identifier || event.conversion_identifier}`;
      }
      if (event.content) {
        const content = typeof event.content === "string" ? event.content : JSON.stringify(event.content);
        if (content.length < 500) description += `\n${content}`;
      }
      if (event.event_source) {
        description += `\nOrigem: ${event.event_source}`;
      }

      await supabase.from("lead_interactions").insert({
        lead_id: leadId,
        type: interactionType,
        description,
        occurred_at: occurredAt,
        created_by: userId,
      });
    }

    console.log(`[events] Imported ${Math.min(events.length, 50)} events for lead ${leadId}`);
  } catch (err: any) {
    console.error(`[events] Error importing events for ${uuid}:`, err.message);
  }
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

// ─── MATCH PROPERTY from RD Station contact data ───

async function matchProperty(
  supabase: any,
  orgId: string,
  contact: Record<string, any>
): Promise<string | null> {
  try {
    // Collect all text hints from the contact that could reference a property
    const hints: string[] = [];

    // Conversion identifiers (form names, landing page names)
    const extractConversionId = (conv: any) => {
      if (!conv) return;
      const content = conv.content || conv;
      const id = content.identifier || content.conversion_identifier;
      if (id) hints.push(id);
    };
    extractConversionId(contact.first_conversion);
    extractConversionId(contact.last_conversion);
    if (contact.conversion_identifier) hints.push(contact.conversion_identifier);

    // Tags
    if (Array.isArray(contact.tags)) {
      hints.push(...contact.tags.filter((t: any) => typeof t === "string"));
    }

    // Custom fields that might reference a property
    if (contact.custom_fields && typeof contact.custom_fields === "object") {
      for (const [key, value] of Object.entries(contact.custom_fields)) {
        if (value && typeof value === "string" && /imovel|imóvel|property|empreendimento|lote|casa|apto|apartamento|loteamento/i.test(key)) {
          hints.push(value);
        }
      }
    }

    // Direct fields
    if (contact.cf_imovel_interesse) hints.push(contact.cf_imovel_interesse);
    if (contact.cf_empreendimento) hints.push(contact.cf_empreendimento);

    if (hints.length === 0) return null;

    // Fetch properties for this org
    const { data: properties } = await supabase
      .from("properties")
      .select("id, title, property_code")
      .eq("organization_id", orgId)
      .limit(500);

    if (!properties || properties.length === 0) return null;

    // Try exact match by property_code first
    for (const hint of hints) {
      const normalized = hint.trim().toLowerCase();
      for (const prop of properties) {
        if (prop.property_code && prop.property_code.toLowerCase() === normalized) {
          return prop.id;
        }
      }
    }

    // Try if property_code appears inside any hint
    for (const hint of hints) {
      const normalized = hint.toLowerCase();
      for (const prop of properties) {
        if (prop.property_code && normalized.includes(prop.property_code.toLowerCase())) {
          return prop.id;
        }
      }
    }

    // Try title match (hint contains title or title contains hint)
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

function extractConversionId(conv: any): string | null {
  if (!conv) return null;
  const content = conv.content || conv;
  return content.identifier || content.identificador || content.conversion_identifier || content.event_identifier || null;
}

function extractConversionIdentifier(data: Record<string, any>): string | null {
  // Try last_conversion first (most recent), then first_conversion
  const lastId = extractConversionId(data.last_conversion);
  if (lastId) return lastId;
  const firstId = extractConversionId(data.first_conversion);
  if (firstId) return firstId;
  if (data.conversion_identifier) return data.conversion_identifier;
  return null;
}

function extractTrafficSource(data: Record<string, any>): string | null {
  if (data.traffic_source) return data.traffic_source;
  const lc = data.last_conversion;
  if (lc) {
    const content = lc.content || lc;
    if (lc.source) return lc.source;
    if (content.source) return content.source;
    if (content.traffic_source) return content.traffic_source;
  }
  const fc = data.first_conversion;
  if (fc) {
    const content = fc.content || fc;
    if (fc.source) return fc.source;
    if (content.source) return content.source;
    if (content.traffic_source) return content.traffic_source;
  }
  return null;
}

function buildNotes(data: Record<string, any>): string {
  const ignore = new Set([
    "uuid", "name", "email", "personal_phone", "mobile_phone",
    "first_name", "last_name", "traffic_source", "conversion_identifier",
  ]);
  const lines: string[] = [];

  // Top-level conversion identifier (ad/form name)
  const convId = extractConversionIdentifier(data);
  if (convId) {
    lines.push(`Anúncio/Formulário: ${convId}`);
  }

  // Traffic source
  const trafficSrc = extractTrafficSource(data);
  if (trafficSrc) {
    lines.push(`Origem do tráfego: ${trafficSrc}`);
  }

  // Extract conversion events
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
    const fcId = extractConversionId(data.first_conversion);
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

  // RD UUID for reference
  if (data.uuid) lines.push(`RD UUID: ${data.uuid}`);

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
    ? `[Sincronizado via RD Station API]\n${lines.join("\n")}`
    : "[Sincronizado via RD Station API]";
}