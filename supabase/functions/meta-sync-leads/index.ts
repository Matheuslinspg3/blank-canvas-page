import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Robust dedup helper ───

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Finds an existing CRM lead by email (case-insensitive), phone (suffix match),
 * or exact name match as last resort.
 * Returns the lead id or null.
 */
/**
 * Resolves human-readable ad / adset / campaign names for a Meta external_ad_id,
 * walking up ad → adset → campaign via `parent_external_id` in `ad_entities`.
 */
async function resolveAdContext(
  supabase: any,
  orgId: string,
  externalAdId: string | null | undefined,
): Promise<{ adName: string | null; adsetName: string | null; campaignName: string | null }> {
  if (!externalAdId || externalAdId === "unknown") {
    return { adName: null, adsetName: null, campaignName: null };
  }
  const { data: ad } = await supabase
    .from("ad_entities")
    .select("name, parent_external_id")
    .eq("organization_id", orgId)
    .eq("provider", "meta")
    .eq("entity_type", "ad")
    .eq("external_id", externalAdId)
    .maybeSingle();
  if (!ad) return { adName: null, adsetName: null, campaignName: null };

  let adsetName: string | null = null;
  let campaignName: string | null = null;
  if (ad.parent_external_id) {
    const { data: adset } = await supabase
      .from("ad_entities")
      .select("name, parent_external_id")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .eq("entity_type", "adset")
      .eq("external_id", ad.parent_external_id)
      .maybeSingle();
    if (adset) {
      adsetName = adset.name ?? null;
      if (adset.parent_external_id) {
        const { data: campaign } = await supabase
          .from("ad_entities")
          .select("name")
          .eq("organization_id", orgId)
          .eq("provider", "meta")
          .eq("entity_type", "campaign")
          .eq("external_id", adset.parent_external_id)
          .maybeSingle();
        campaignName = campaign?.name ?? null;
      }
    }
  }
  return { adName: ad.name ?? null, adsetName, campaignName };
}

function buildMetaLeadFields(ctx: { adName: string | null; adsetName: string | null; campaignName: string | null }, externalAdId: string | null) {
  const tag = ctx.adName || ctx.campaignName || "Meta Ads";
  const noteParts = [`Lead importado de Meta Ads`];
  if (ctx.campaignName) noteParts.push(`Campanha: ${ctx.campaignName}`);
  if (ctx.adsetName) noteParts.push(`Conjunto: ${ctx.adsetName}`);
  if (ctx.adName) noteParts.push(`Anúncio: ${ctx.adName}`);
  if (externalAdId && externalAdId !== "unknown") noteParts.push(`Ad ID: ${externalAdId}`);
  return {
    source: tag,
    external_source: "meta_ads",
    conversion_identifier: ctx.adName || null,
    traffic_source: ctx.campaignName || "Meta Ads",
    notes: noteParts.join(" • "),
  };
}

async function findExistingCrmLead(
  supabase: any,
  orgId: string,
  email: string | null,
  phone: string | null,
  name: string | null
): Promise<string | null> {
  // 1. Email match (case-insensitive)
  if (email) {
    const normalized = normalizeEmail(email);
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }

  // 2. Phone match (normalized suffix matching)
  if (phone) {
    const digits = normalizePhone(phone);
    if (digits.length >= 8) {
      // Use last 8-11 digits for suffix match to handle country code variations
      const suffix = digits.slice(-11);
      const shortSuffix = digits.slice(-8);

      const { data: phoneCandidates } = await supabase
        .from("leads")
        .select("id, phone")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .not("phone", "is", null)
        .limit(500);

      if (phoneCandidates?.length) {
        const match = phoneCandidates.find((l: any) => {
          const lDigits = normalizePhone(l.phone || "");
          if (lDigits.length < 8) return false;
          // Match if the last 8+ digits overlap
          return (
            lDigits === digits ||
            lDigits.endsWith(shortSuffix) ||
            suffix.endsWith(lDigits.slice(-8))
          );
        });
        if (match) return match.id;
      }
    }
  }

  // 3. Name match (exact, trimmed, case-insensitive) — only if name is meaningful
  if (name && name.length >= 3) {
    const trimmed = name.trim();
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }

  return null;
}

/**
 * Marks an ad_lead as sent_to_crm, linking it to an existing CRM lead.
 */
async function linkAdLeadToCrm(supabase: any, adLeadId: string, crmLeadId: string) {
  await supabase
    .from("ad_leads")
    .update({
      status: "sent_to_crm",
      crm_record_id: crmLeadId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", adLeadId);
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch {}

    const isAutoSync = body?.auto_sync === true;

    if (isAutoSync) {
      return await handleAutoSync(supabase);
    }

    // ── Manual / Preview / Import modes require JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("[meta-sync-leads] JWT validation failed:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 400, headers: corsHeaders });
    }

    const orgId = profile.organization_id;

    const { data: account } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .eq("is_active", true)
      .single();

    if (!account?.auth_payload?.access_token) {
      return new Response(JSON.stringify({ error: "Meta account not connected" }), { status: 400, headers: corsHeaders });
    }

    const accessToken = account.auth_payload.access_token;

    const mode = body.mode || "sync";
    const daysBack = Math.min(body.days_back || 7, 90);
    const selectedLeadIds: string[] = body.selected_lead_ids || [];
    const crmStageId: string | null = body.crm_stage_id || null;

    if (mode === "import") {
      return await handleImport(supabase, orgId, userId, selectedLeadIds, crmStageId);
    }

    const result = await syncOrgLeads(supabase, accessToken, orgId, userId, daysBack);

    if (mode === "sync") {
      return new Response(
        JSON.stringify({ synced: result.synced, skipped: result.skipped, auto_sent: result.autoSent, forms: result.forms, pages: result.pages }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ leads: result.newLeads, total: result.newLeads.length, pages: result.pages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

// ─── AUTO SYNC ───

async function handleAutoSync(supabase: any): Promise<Response> {
  console.log("[meta-auto-sync] Starting auto sync for all orgs...");

  const { data: accounts, error: accErr } = await supabase
    .from("ad_accounts")
    .select("organization_id, auth_payload")
    .eq("provider", "meta")
    .eq("is_active", true)
    .not("auth_payload", "is", null);

  if (accErr || !accounts?.length) {
    console.log("[meta-auto-sync] No active Meta accounts:", accErr?.message || "0 accounts");
    return new Response(
      JSON.stringify({ success: true, message: "No orgs to sync", orgs_processed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: any[] = [];

  for (const account of accounts) {
    const orgId = account.organization_id;
    const accessToken = account.auth_payload?.access_token;

    if (!accessToken) {
      results.push({ org: orgId, error: "No access token" });
      continue;
    }

    try {
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

      const syncResult = await syncOrgLeads(supabase, accessToken, orgId, adminProfile.user_id, 3);
      results.push({ org: orgId, synced: syncResult.synced, auto_sent: syncResult.autoSent, duplicates: syncResult.duplicates });

      await sleep(1500);
    } catch (orgErr: any) {
      console.error(`[meta-auto-sync] Error for org ${orgId}:`, orgErr);
      results.push({ org: orgId, error: orgErr.message });
    }
  }

  console.log(`[meta-auto-sync] Completed. Processed ${results.length} orgs.`);

  return new Response(
    JSON.stringify({ success: true, orgs_processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Core sync logic ───

async function syncOrgLeads(
  supabase: any,
  accessToken: string,
  orgId: string,
  userId: string,
  daysBack: number
): Promise<{ synced: number; skipped: number; autoSent: number; duplicates: number; forms: number; pages: number; newLeads: any[] }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
  );
  const pagesData = await pagesRes.json();

  if (pagesData.error) {
    console.error("[meta-sync-leads] Meta API error (pages):", JSON.stringify(pagesData.error));
    throw new Error(`Meta API error: ${pagesData.error.message}`);
  }

  const pages = pagesData.data || [];
  if (pages.length === 0) {
    return { synced: 0, skipped: 0, autoSent: 0, duplicates: 0, forms: 0, pages: 0, newLeads: [] };
  }

  const allLeads: any[] = [];
  let totalSynced = 0;
  let totalSkipped = 0;
  let totalForms = 0;

  for (const page of pages) {
    const pageToken = page.access_token || accessToken;

    const formsRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}/leadgen_forms?fields=id,name&access_token=${pageToken}`
    );
    const formsData = await formsRes.json();
    if (formsData.error) continue;

    const forms = formsData.data || [];
    totalForms += forms.length;

    for (const form of forms) {
      let leadsUrl: string | null = `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,created_time,field_data,ad_id&limit=100&access_token=${pageToken}`;

      while (leadsUrl) {
        const leadsRes = await fetch(leadsUrl);
        const leadsData = await leadsRes.json();
        if (leadsData.error) break;

        for (const lead of (leadsData.data || [])) {
          const createdTime = new Date(lead.created_time);
          if (createdTime < cutoff) continue;

          const fieldData = lead.field_data || [];
          const getField = (name: string) => {
            const f = fieldData.find((fd: any) => fd.name === name);
            return f?.values?.[0] || null;
          };

          const name = getField("full_name") || getField("nome") || getField("name");
          const email = getField("email");
          const phone = getField("phone_number") || getField("telefone") || getField("phone");

          const { data: upserted, error: upsertError } = await supabase
            .from("ad_leads")
            .upsert({
              organization_id: orgId,
              provider: "meta",
              external_lead_id: lead.id,
              external_ad_id: lead.ad_id || "unknown",
              external_form_id: form.id,
              name,
              email,
              phone,
              created_time: lead.created_time,
              raw_payload: lead,
              updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,external_lead_id" })
            .select("id, name, email, phone, created_time, status, external_form_id, external_ad_id")
            .single();

          if (upsertError) {
            totalSkipped++;
          } else {
            totalSynced++;
            if (upserted) {
              allLeads.push({ ...upserted, form_name: form.name, page_name: page.name });
            }
          }
        }

        leadsUrl = leadsData.paging?.next || null;
      }
    }
  }

  // ── Auto-send to CRM with robust dedup ──
  const { data: adSettings } = await supabase
    .from("ad_settings")
    .select("auto_send_to_crm, crm_stage_id")
    .eq("organization_id", orgId)
    .single();

  let autoSent = 0;
  let duplicates = 0;

  if (adSettings?.auto_send_to_crm && adSettings?.crm_stage_id) {
    const { data: newAdLeads } = await supabase
      .from("ad_leads")
      .select("id, name, email, phone, external_ad_id")
      .eq("organization_id", orgId)
      .eq("status", "new");

    for (const nl of (newAdLeads || [])) {
      // Skip if already linked (race condition guard)
      if (nl.crm_record_id) {
        duplicates++;
        continue;
      }

      const existingId = await findExistingCrmLead(supabase, orgId, nl.email, nl.phone, nl.name);

      if (existingId) {
        await linkAdLeadToCrm(supabase, nl.id, existingId);
        duplicates++;
        autoSent++;
        continue;
      }

      // Create new CRM lead
      const adCtx = await resolveAdContext(supabase, orgId, nl.external_ad_id);
      const metaFields = buildMetaLeadFields(adCtx, nl.external_ad_id);
      const { data: crmLead, error: crmError } = await supabase
        .from("leads")
        .insert({
          name: nl.name || "Lead de Anúncio",
          email: nl.email ? normalizeEmail(nl.email) : null,
          phone: nl.phone,
          organization_id: orgId,
          created_by: userId,
          lead_stage_id: adSettings.crm_stage_id,
          stage: "novo",
          ...metaFields,
          consent_voice_call: resolveVoiceConsent({ source: "anuncio", explicit: null, hasPhone: !!nl.phone }),
        })
        .select("id").single();

      if (!crmError && crmLead) {
        await linkAdLeadToCrm(supabase, nl.id, crmLead.id);
        autoSent++;
      }
    }
  }

  const newLeads = allLeads.filter((l: any) => l.status === "new");
  return { synced: totalSynced, skipped: totalSkipped, autoSent, duplicates, forms: totalForms, pages: pages.length, newLeads };
}

// ─── Import mode ───

async function handleImport(
  supabase: any,
  orgId: string,
  userId: string,
  selectedLeadIds: string[],
  crmStageId: string | null
): Promise<Response> {
  if (!selectedLeadIds.length) {
    return new Response(JSON.stringify({ error: "No leads selected" }), { status: 400, headers: corsHeaders });
  }

  const { data: adLeads } = await supabase
    .from("ad_leads")
    .select("*")
    .eq("organization_id", orgId)
    .in("id", selectedLeadIds)
    .eq("status", "new");

  let imported = 0;
  let skipped = 0;

  for (const nl of (adLeads || [])) {
    const existingId = await findExistingCrmLead(supabase, orgId, nl.email, nl.phone, nl.name);

    if (existingId) {
      await linkAdLeadToCrm(supabase, nl.id, existingId);
      skipped++;
      continue;
    }

    const { data: crmLead, error: crmError } = await supabase
      .from("leads")
      .insert({
        name: nl.name || "Lead de Anúncio",
        email: nl.email ? normalizeEmail(nl.email) : null,
        phone: nl.phone,
        organization_id: orgId,
        created_by: userId,
        lead_stage_id: crmStageId,
        stage: "novo",
        source: "anuncio",
        notes: `Lead importado de Meta Ads (Ad ID: ${nl.external_ad_id})`,
      })
      .select("id")
      .single();

    if (!crmError && crmLead) {
      await linkAdLeadToCrm(supabase, nl.id, crmLead.id);
      imported++;
    } else {
      skipped++;
    }
  }

  return new Response(
    JSON.stringify({ imported, skipped, duplicates: skipped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
