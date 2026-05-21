import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-meta-reprocess-log-id",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const SENTRY_DSN = Deno.env.get("SENTRY_DSN") || "";
const ENV = Deno.env.get("ENV") || Deno.env.get("SUPABASE_ENV") || "unknown";

type FailureStatus = "pending" | "retrying" | "failed" | "resolved" | "error";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      console.log("Meta lead webhook verification succeeded");
      return new Response(challenge ?? "", { status: 200 });
    }
    await captureMetaIssue("meta_webhook_verification_failed", { route: "meta-leadgen-webhook", mode, hasToken: Boolean(token) });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const rawBody = await req.text();
  const reprocessLogId = req.headers.get("x-meta-reprocess-log-id");

  if (APP_SECRET && !reprocessLogId) {
    const signature = req.headers.get("x-hub-signature-256") || "";
    const ok = await verifySignature(APP_SECRET, rawBody, signature);
    if (!ok) {
      console.error("Meta lead webhook signature validation failed");
      await captureMetaIssue("meta_webhook_invalid_signature", { route: "meta-leadgen-webhook" });
      return new Response("invalid signature", { status: 401 });
    }
  } else if (!reprocessLogId) {
    console.warn("Meta app secret not configured, signature validation skipped");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await captureMetaIssue("meta_webhook_invalid_payload_json", { route: "meta-leadgen-webhook" });
    return new Response("bad json", { status: 400 });
  }

  try {
    await processLeadgenPayload(payload, reprocessLogId);
  } catch (err) {
    console.error("Unexpected Meta lead webhook processing error", err);
    await captureMetaIssue("meta_webhook_processing_unexpected", { route: "meta-leadgen-webhook" }, err);
  }

  return new Response("ok", { status: 200 });
});

async function processLeadgenPayload(payload: any, reprocessLogId: string | null) {
  let entries: any[] = payload?.entry || [];
  if (!entries.length && payload?.leadgen_id) entries = [{ changes: [{ field: "leadgen", value: payload }] }];
  if (!entries.length) return;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  for (const entry of entries) {
    for (const change of (entry.changes || [])) {
      if (change.field !== "leadgen") continue;

      const leadgenId = change.value?.leadgen_id;
      const pageId = change.value?.page_id;
      const formId = change.value?.form_id;
      const adId = change.value?.ad_id;

      if (!leadgenId || !pageId) {
        await captureMetaIssue("meta_webhook_missing_required_ids", { leadgen_id: leadgenId, page_id: pageId, form_id: formId });
        await saveFailure(admin, { organization_id: null, leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: change.value, status: "failed", reason: "missing leadgen_id or page_id" });
        continue;
      }

      console.log(`Meta lead webhook received: leadgen_id=${leadgenId}, page_id=${pageId}`);
      const { data: accounts } = await admin.from("ad_accounts").select("organization_id, auth_payload").eq("provider", "meta").eq("is_active", true).not("auth_payload", "is", null);
      if (!accounts?.length) {
        await captureMetaIssue("meta_no_active_accounts", { leadgen_id: leadgenId, page_id: pageId, form_id: formId });
        await saveFailure(admin, { organization_id: null, leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: change.value, status: "pending", reason: "no active meta accounts" });
        continue;
      }

      let processed = false;
      let failureAlreadySaved = false;
      for (const acc of accounts) {
        const accessToken = acc.auth_payload?.access_token;
        if (!accessToken) continue;
        try {
          const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${accessToken}`);
          const pagesData = await pagesRes.json();
          if (pagesData.error) continue;
          const page = (pagesData.data || []).find((p: any) => p.id === pageId);
          if (!page) continue;

          const orgId = acc.organization_id;
          const pageToken = page.access_token || accessToken;
          const webhookLogId = reprocessLogId || (await createWebhookLog(admin, orgId, leadgenId, change.value));

          const leadRes = await fetch(`https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,field_data,ad_id,form_id,campaign_id,adset_id&access_token=${pageToken}`);
          const leadData = await leadRes.json();
          if (leadData.error) {
            await markWebhookLog(admin, webhookLogId, "error", `graph_fetch_failed: ${leadData.error.message || "unknown"}`);
            await captureMetaIssue("meta_graph_fetch_failed", { leadgen_id: leadgenId, page_id: pageId, form_id: formId, organization_id: orgId, error_code: leadData.error.code });
            await saveFailure(admin, { organization_id: orgId, leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: change.value, status: "pending", reason: "graph api lead fetch failed" });
            failureAlreadySaved = true;
            continue;
          }

          const upserted = await upsertAdLead(admin, orgId, leadgenId, adId, formId, leadData);
          if (!upserted) {
            await markWebhookLog(admin, webhookLogId, "error", "ad_leads_upsert_failed");
            await saveFailure(admin, { organization_id: orgId, leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: leadData, status: "failed", reason: "ad_leads upsert failed" });
            failureAlreadySaved = true;
            continue;
          }

          await markWebhookLog(admin, webhookLogId, "processed", null);
          if (upserted.status === "new") await autoSendToCrm(admin, orgId, upserted, { leadgenId, pageId, formId, adId: upserted.external_ad_id || adId });
          else console.log(`Meta lead skipped because duplicate leadgen_id already exists: ${leadgenId}`);
          processed = true;
          break;
        } catch (err) {
          await captureMetaIssue("meta_account_processing_failed", { leadgen_id: leadgenId, page_id: pageId, form_id: formId, organization_id: acc.organization_id }, err);
        }
      }

      if (!processed && !failureAlreadySaved) {
        await captureMetaIssue("meta_page_mapping_not_found", { leadgen_id: leadgenId, page_id: pageId, form_id: formId });
        await saveFailure(admin, { organization_id: null, leadgen_id: leadgenId, page_id: pageId, form_id: formId, payload: change.value, status: "pending", reason: "page_id/form_id mapping not found" });
      }
    }
  }
}

async function upsertAdLead(admin: any, orgId: string, leadgenId: string, adId: string | null, formId: string | null, leadData: any) {
  const fieldData = leadData.field_data || [];
  const getField = (name: string) => fieldData.find((fd: any) => fd.name === name)?.values?.[0] || null;
  const name = getField("full_name") || getField("nome_completo") || getField("nome") || getField("name");
  const email = getField("email") || getField("e-mail");
  const phone = getField("phone_number") || getField("telefone") || getField("phone") || getField("whatsapp") || getField("celular");
  const externalAdId = leadData.ad_id || adId || "unknown";
  const externalFormId = leadData.form_id || formId || null;

  const { data, error } = await admin.from("ad_leads").upsert({
    organization_id: orgId, provider: "meta", external_lead_id: leadgenId, external_ad_id: externalAdId,
    external_form_id: externalFormId, name, email, phone, created_time: leadData.created_time || new Date().toISOString(), raw_payload: leadData, updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,external_lead_id" }).select("id, name, email, phone, status, external_ad_id, external_lead_id, crm_record_id").single();

  if (error) {
    await captureMetaIssue("meta_ad_lead_upsert_failed", { leadgen_id: leadgenId, form_id: externalFormId, page_id: null, organization_id: orgId }, error);
    return null;
  }
  return data;
}

function normalizeEmail(raw: string): string { return raw.trim().toLowerCase(); }

async function resolveAdContext(supabase: any, orgId: string, externalAdId: string | null | undefined) {
  if (!externalAdId || externalAdId === "unknown") return { adName: null, adsetName: null, campaignName: null };
  const { data: ad } = await supabase.from("ad_entities").select("name, parent_external_id").eq("organization_id", orgId).eq("provider", "meta").eq("entity_type", "ad").eq("external_id", externalAdId).maybeSingle();
  if (!ad) return { adName: null, adsetName: null, campaignName: null };
  let adsetName: string | null = null; let campaignName: string | null = null;
  if (ad.parent_external_id) {
    const { data: adset } = await supabase.from("ad_entities").select("name, parent_external_id").eq("organization_id", orgId).eq("provider", "meta").eq("entity_type", "adset").eq("external_id", ad.parent_external_id).maybeSingle();
    if (adset) { adsetName = adset.name ?? null; if (adset.parent_external_id) { const { data: campaign } = await supabase.from("ad_entities").select("name").eq("organization_id", orgId).eq("provider", "meta").eq("entity_type", "campaign").eq("external_id", adset.parent_external_id).maybeSingle(); campaignName = campaign?.name ?? null; } }
  }
  return { adName: ad.name ?? null, adsetName, campaignName };
}

async function autoSendToCrm(admin: any, orgId: string, adLead: any, ctx: any) {
  try {
    const { data: adSettings } = await admin.from("ad_settings").select("auto_send_to_crm, crm_stage_id").eq("organization_id", orgId).maybeSingle();
    if (!adSettings?.auto_send_to_crm || !adSettings?.crm_stage_id) {
      await saveFailure(admin, { organization_id: orgId, leadgen_id: ctx.leadgenId, page_id: ctx.pageId, form_id: ctx.formId, payload: { ad_lead_id: adLead.id }, status: "pending", reason: "auto-send disabled or crm stage missing" });
      return;
    }
    const { data: adminProfile } = await admin.from("profiles").select("user_id").eq("organization_id", orgId).limit(1).single();
    if (!adminProfile) return;
    const adCtx = await resolveAdContext(admin, orgId, adLead.external_ad_id);
    const tag = adCtx.adName || adCtx.campaignName || "Meta Ads";

    const { data: mergedId } = await admin.rpc("merge_external_lead", { p_organization_id: orgId, p_email: adLead.email, p_phone: adLead.phone, p_external_source: "meta_ads", p_source: tag, p_traffic_source: adCtx.campaignName || "Meta Ads", p_conversion_identifier: adCtx.adName, p_external_id: adLead.external_lead_id ?? null, p_window_days: 30 });
    if (mergedId) {
      await admin.from("ad_leads").update({ status: "sent_to_crm", crm_record_id: mergedId, updated_at: new Date().toISOString() }).eq("id", adLead.id);
      return;
    }

    const { data: crmLead, error: crmError } = await admin.from("leads").insert({
      name: adLead.name || "Lead de Anúncio", email: adLead.email ? normalizeEmail(adLead.email) : null, phone: adLead.phone,
      organization_id: orgId, created_by: adminProfile.user_id, lead_stage_id: adSettings.crm_stage_id, stage: "novo", source: tag,
      external_source: "meta_ads", conversion_identifier: adCtx.adName || null, traffic_source: adCtx.campaignName || "Meta Ads",
      notes: "Lead importado de Meta Ads (webhook real-time)", consent_voice_call: resolveVoiceConsent({ source: "anuncio", explicit: null, hasPhone: !!adLead.phone }),
    }).select("id").single();

    if (crmError || !crmLead) {
      await captureMetaIssue("meta_crm_insert_failed", { leadgen_id: ctx.leadgenId, page_id: ctx.pageId, form_id: ctx.formId, organization_id: orgId }, crmError);
      await admin.from("ad_leads").update({ status: "send_failed", status_reason: crmError?.message, updated_at: new Date().toISOString() }).eq("id", adLead.id);
      await saveFailure(admin, { organization_id: orgId, leadgen_id: ctx.leadgenId, page_id: ctx.pageId, form_id: ctx.formId, payload: { ad_lead_id: adLead.id }, status: "failed", reason: `crm insert failed: ${crmError?.message || "unknown"}` });
      return;
    }

    await admin.from("ad_leads").update({ status: "sent_to_crm", crm_record_id: crmLead.id, updated_at: new Date().toISOString() }).eq("id", adLead.id);
    await resolveFailureByLead(admin, orgId, ctx.leadgenId);
  } catch (err) {
    await captureMetaIssue("meta_crm_autosend_unexpected", { leadgen_id: ctx.leadgenId, page_id: ctx.pageId, form_id: ctx.formId, organization_id: orgId }, err);
  }
}

async function createWebhookLog(admin: any, orgId: string, leadgenId: string, payload: any) {
  const { data } = await admin.from("ad_webhook_logs").insert({ organization_id: orgId, provider: "meta", external_lead_id: leadgenId, payload, status: "received" }).select("id").single();
  return data?.id || null;
}
async function markWebhookLog(admin: any, id: string | null, status: string, error: string | null) {
  if (!id) return;
  await admin.from("ad_webhook_logs").update({ status, error_message: error }).eq("id", id);
}
async function saveFailure(admin: any, f: { organization_id: string | null; leadgen_id: string | null; page_id: string | null; form_id: string | null; payload: any; status: FailureStatus; reason: string; }) {
  const safeLeadgenId = f.leadgen_id || `missing:${f.page_id || "unknown"}:${f.form_id || "unknown"}:${Date.now()}`;
  const { data: existing } = await admin.from("meta_lead_failures").select("attempt_count").eq("provider", "meta").eq("leadgen_id", safeLeadgenId).maybeSingle();
  const nextAttempts = (existing?.attempt_count || 0) + 1;
  await admin.from("meta_lead_failures").upsert({ organization_id: f.organization_id, provider: "meta", leadgen_id: safeLeadgenId, page_id: f.page_id, form_id: f.form_id, payload: f.payload, status: f.status, reason: f.reason, attempt_count: nextAttempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "provider,leadgen_id" });
}
async function resolveFailureByLead(admin: any, orgId: string, leadgenId: string) {
  await admin.from("meta_lead_failures").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("organization_id", orgId).eq("provider", "meta").eq("leadgen_id", leadgenId);
}

async function captureMetaIssue(event: string, context: Record<string, unknown>, err?: any) {
  if (!SENTRY_DSN) return;
  const body = { event_id: crypto.randomUUID().replace(/-/g, ""), level: "error", platform: "javascript", environment: ENV, tags: { source: "meta_ads", event, route: "meta-leadgen-webhook" }, extra: context, exception: err ? { values: [{ type: err?.name || "Error", value: err?.message || String(err) }] } : undefined };
  try { await fetch(SENTRY_DSN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); } catch {}
}

async function verifySignature(secret: string, body: string, header: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, expected);
}
function timingSafeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
