/**
 * Meta Leadgen Webhook — receives real-time lead notifications from Meta Ads.
 *
 * When a user fills out a Lead Ads form, Meta sends a webhook immediately.
 * This function fetches the lead data from the Graph API, upserts into ad_leads,
 * and auto-sends to CRM if configured — achieving near-instant lead delivery.
 *
 * GET  → subscription verification handshake
 * POST → leadgen event processing
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = verification handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      console.log("[meta-leadgen-webhook] Verification OK");
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const reprocessLogId = req.headers.get("x-meta-reprocess-log-id");

  // Signature check - skip if it's a reprocess call from our own app
  if (APP_SECRET && !reprocessLogId) {
    const signature = req.headers.get("x-hub-signature-256") || "";
    const ok = await verifySignature(APP_SECRET, rawBody, signature);
    if (!ok) {
      console.error("[meta-leadgen-webhook] invalid_signature");
      return new Response("invalid signature", { status: 401 });
    }
  } else if (!reprocessLogId) {
    console.warn("[meta-leadgen-webhook] META_APP_SECRET not configured; skipping signature check");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Always ack to Meta immediately — process best-effort
  try {
    // If it's a reprocess call, we might need to handle the payload differently 
    // depending on if it's the raw Meta entry or just the change value.
    // For simplicity, we support both.
    await processLeadgenPayload(payload);
  } catch (err) {
    console.error("[meta-leadgen-webhook] process_error", err);
  }

  return new Response("ok", { status: 200 });
});

// ─── Leadgen Processing ───

async function processLeadgenPayload(payload: any) {
  let entries: any[] = payload?.entry || [];
  
  // If no entries but it looks like a single change value (reprocess case)
  if (!entries.length && payload?.leadgen_id) {
    entries = [{
      changes: [{
        field: "leadgen",
        value: payload
      }]
    }];
  }

  if (!entries.length) return;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  for (const entry of entries) {
    const changes: any[] = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "leadgen") continue;

      const leadgenId = change.value?.leadgen_id;
      const pageId = change.value?.page_id;
      const formId = change.value?.form_id;
      const adId = change.value?.ad_id;
      const createdTime = change.value?.created_time
        ? new Date(change.value.created_time * 1000).toISOString()
        : new Date().toISOString();

      if (!leadgenId || !pageId) {
        console.warn("[meta-leadgen-webhook] missing leadgen_id or page_id", change.value);
        continue;
      }

      console.log(`[meta-leadgen-webhook] Processing lead ${leadgenId} from page ${pageId}`);

      // Find which org owns this page
      const { data: account } = await admin
        .from("ad_accounts")
        .select("organization_id, auth_payload")
        .eq("provider", "meta")
        .eq("is_active", true)
        .not("auth_payload", "is", null);

      if (!account?.length) {
        console.warn("[meta-leadgen-webhook] No active Meta accounts found");
        continue;
      }

      // Try each account to find the page owner and fetch lead data
      let processed = false;
      let targetOrgId: string | null = null;

      for (const acc of account) {
        const accessToken = acc.auth_payload?.access_token;
        if (!accessToken) continue;

        try {
          // Get page token for this page
          const pagesRes = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${accessToken}`,
          );
          const pagesData = await pagesRes.json();
          if (pagesData.error) continue;

          const page = (pagesData.data || []).find((p: any) => p.id === pageId);
          if (!page) continue;

          targetOrgId = acc.organization_id;
          const pageToken = page.access_token || accessToken;

          // Create initial log
          await admin.from("ad_webhook_logs").insert({
            organization_id: targetOrgId,
            provider: "meta",
            external_lead_id: leadgenId,
            payload: change.value,
            status: "received",
          });

          // Fetch the actual lead data from Graph API
          const leadRes = await fetch(
            `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,field_data,ad_id,form_id&access_token=${pageToken}`,
          );
          const leadData = await leadRes.json();

          if (leadData.error) {
            console.error(`[meta-leadgen-webhook] Graph API error fetching lead ${leadgenId}:`, leadData.error);
            continue;
          }

          const fieldData = leadData.field_data || [];
          const getField = (name: string) => {
            const f = fieldData.find((fd: any) => fd.name === name);
            return f?.values?.[0] || null;
          };

          const name = getField("full_name") || getField("nome") || getField("name");
          const email = getField("email");
          const phone = getField("phone_number") || getField("telefone") || getField("phone");
          const externalAdId = leadData.ad_id || adId || "unknown";
          const externalFormId = leadData.form_id || formId || null;

          const orgId = acc.organization_id;

          // Upsert into ad_leads
          const { data: upserted, error: upsertError } = await admin
            .from("ad_leads")
            .upsert(
              {
                organization_id: orgId,
                provider: "meta",
                external_lead_id: leadgenId,
                external_ad_id: externalAdId,
                external_form_id: externalFormId,
                name,
                email,
                phone,
                created_time: leadData.created_time || createdTime,
                raw_payload: leadData,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,external_lead_id" },
            )
            .select("id, name, email, phone, status, external_ad_id, external_lead_id, crm_record_id")
            .single();

          if (upsertError) {
            console.error(`[meta-leadgen-webhook] Upsert error for lead ${leadgenId}:`, upsertError);
            await admin.from("ad_webhook_logs").update({
              status: "error",
              error_message: `Upsert error: ${upsertError.message}`,
            }).eq("external_lead_id", leadgenId).eq("organization_id", orgId);
            continue;
          }

          // Update log to processed
          await admin.from("ad_webhook_logs").update({
            status: "processed",
          }).eq("external_lead_id", leadgenId).eq("organization_id", orgId);

          console.log(`[meta-leadgen-webhook] Lead ${leadgenId} upserted for org ${orgId}, status: ${upserted?.status}`);

          // Auto-send to CRM if configured and lead is new
          if (upserted?.status === "new") {
            await autoSendToCrm(admin, orgId, upserted);
          }

          processed = true;
          break; // Found the right account
        } catch (err) {
          console.error(`[meta-leadgen-webhook] Error processing with account for org ${acc.organization_id}:`, err);
        }
      }

      if (!processed) {
        console.warn(`[meta-leadgen-webhook] Could not process lead ${leadgenId} - no matching page found`);
      }
    }
  }
}

// ─── Auto-send to CRM ───

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

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

async function autoSendToCrm(admin: any, orgId: string, adLead: any) {
  try {
    const { data: adSettings } = await admin
      .from("ad_settings")
      .select("auto_send_to_crm, crm_stage_id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!adSettings?.auto_send_to_crm || !adSettings?.crm_stage_id) {
      console.log(`[meta-leadgen-webhook] Auto-send disabled for org ${orgId}`);
      return;
    }

    // Get a user_id for created_by
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", orgId)
      .limit(1)
      .single();

    if (!adminProfile) return;

    const adCtx = await resolveAdContext(admin, orgId, adLead.external_ad_id);
    const tag = adCtx.adName || adCtx.campaignName || "Meta Ads";
    const noteParts = ["Lead importado de Meta Ads (webhook real-time)"];
    if (adCtx.campaignName) noteParts.push(`Campanha: ${adCtx.campaignName}`);
    if (adCtx.adsetName) noteParts.push(`Conjunto: ${adCtx.adsetName}`);
    if (adCtx.adName) noteParts.push(`Anúncio: ${adCtx.adName}`);

    // Try merge first
    const { data: mergedId } = await admin.rpc("merge_external_lead", {
      p_organization_id: orgId,
      p_email: adLead.email,
      p_phone: adLead.phone,
      p_external_source: "meta_ads",
      p_source: tag,
      p_traffic_source: adCtx.campaignName || "Meta Ads",
      p_conversion_identifier: adCtx.adName,
      p_external_id: adLead.external_lead_id ?? null,
      p_window_days: 30,
    });

    if (mergedId) {
      await admin
        .from("ad_leads")
        .update({ status: "sent_to_crm", crm_record_id: mergedId, updated_at: new Date().toISOString() })
        .eq("id", adLead.id);
      console.log(`[meta-leadgen-webhook] Lead ${adLead.id} merged into existing CRM lead ${mergedId}`);
      return;
    }

    // Create new CRM lead
    const { data: crmLead, error: crmError } = await admin
      .from("leads")
      .insert({
        name: adLead.name || "Lead de Anúncio",
        email: adLead.email ? normalizeEmail(adLead.email) : null,
        phone: adLead.phone,
        organization_id: orgId,
        created_by: adminProfile.user_id,
        lead_stage_id: adSettings.crm_stage_id,
        stage: "novo",
        source: tag,
        external_source: "meta_ads",
        conversion_identifier: adCtx.adName || null,
        traffic_source: adCtx.campaignName || "Meta Ads",
        notes: noteParts.join(" • "),
        consent_voice_call: resolveVoiceConsent({ source: "anuncio", explicit: null, hasPhone: !!adLead.phone }),
      })
      .select("id")
      .single();

    if (!crmError && crmLead) {
      await admin
        .from("ad_leads")
        .update({ status: "sent_to_crm", crm_record_id: crmLead.id, updated_at: new Date().toISOString() })
        .eq("id", adLead.id);
      console.log(`[meta-leadgen-webhook] Lead ${adLead.id} → CRM lead ${crmLead.id} created instantly`);
    } else {
      console.error(`[meta-leadgen-webhook] Failed to create CRM lead:`, crmError);
      await admin
        .from("ad_leads")
        .update({ status: "send_failed", status_reason: crmError?.message, updated_at: new Date().toISOString() })
        .eq("id", adLead.id);
    }
  } catch (err) {
    console.error(`[meta-leadgen-webhook] autoSendToCrm error:`, err);
  }
}

// ─── Crypto helpers ───

async function verifySignature(secret: string, body: string, header: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
