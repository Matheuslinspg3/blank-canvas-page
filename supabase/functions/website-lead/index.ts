import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MESSAGE_LENGTH = 4000;

type Attr = Record<string, unknown>;

const asTrimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const organizationId = asTrimmed(body?.organizationId);
    const name = asTrimmed(body?.name);
    const email = asTrimmed(body?.email) || null;
    const phone = asTrimmed(body?.phone) || null;
    const source = asTrimmed(body?.source) || "website";
    const message = asTrimmed(body?.message).slice(0, MAX_MESSAGE_LENGTH) || null;
    const eventId = asTrimmed(body?.event_id) || crypto.randomUUID();
    const attribution = body?.attribution_context && typeof body.attribution_context === "object"
      ? (body.attribution_context as Attr)
      : null;

    if (!organizationId || !name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: stages } = await sb
      .from("lead_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true })
      .limit(1);

    const { data: members } = await sb
      .from("profiles")
      .select("user_id")
      .eq("organization_id", organizationId)
      .limit(1);

    const createdBy = members?.[0]?.user_id;
    if (!createdBy) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceLabel = typeof attribution?.utm_source === "string" ? attribution.utm_source : source;
    const campaignLabel = typeof attribution?.utm_campaign === "string" ? attribution.utm_campaign : null;
    const notesAttribution = attribution
      ? `\n\n[Attribution] Origem: ${sourceLabel}${campaignLabel ? ` / Campanha: ${campaignLabel}` : ""}`
      : "";

    const { data: inserted, error } = await sb
      .from("leads")
      .insert({
        organization_id: organizationId,
        name,
        email,
        phone,
        notes: `${message ? `[Site] ${message}` : ""}${notesAttribution}` || null,
        source,
        traffic_source: typeof attribution?.utm_source === "string" ? attribution.utm_source : null,
        lead_stage_id: stages?.[0]?.id || null,
        created_by: createdBy,
        consent_voice_call: resolveVoiceConsent({ source, explicit: null, hasPhone: !!phone }),
      })
      .select("id")
      .single();

    if (error) throw error;

    await sb.from("attribution_events").insert({
      lead_id: inserted?.id ?? null,
      organization_id: organizationId,
      event_name: "Lead",
      event_id: eventId,
      source: typeof attribution?.utm_source === "string" ? attribution.utm_source : source,
      medium: typeof attribution?.utm_medium === "string" ? attribution.utm_medium : null,
      campaign: typeof attribution?.utm_campaign === "string" ? attribution.utm_campaign : null,
      content: typeof attribution?.utm_content === "string" ? attribution.utm_content : null,
      term: typeof attribution?.utm_term === "string" ? attribution.utm_term : null,
      fbclid: typeof attribution?.fbclid === "string" ? attribution.fbclid : null,
      gclid: typeof attribution?.gclid === "string" ? attribution.gclid : null,
      fbp: typeof attribution?.fbp === "string" ? attribution.fbp : null,
      fbc: typeof attribution?.fbc === "string" ? attribution.fbc : null,
      landing_page: typeof attribution?.landing_page === "string" ? attribution.landing_page : null,
      referrer: typeof attribution?.referrer === "string" ? attribution.referrer : null,
      session_id: typeof attribution?.session_id === "string" ? attribution.session_id : null,
      anonymous_id: typeof attribution?.anonymous_id === "string" ? attribution.anonymous_id : null,
      consent_state: attribution?.consent_state ?? null,
      event_payload: attribution,
    });

    return new Response(JSON.stringify({ success: true, lead_id: inserted?.id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("website-lead error", { message: err instanceof Error ? err.message : "unknown" });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
