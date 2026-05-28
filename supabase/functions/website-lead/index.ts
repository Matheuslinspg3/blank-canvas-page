import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveVoiceConsent } from "../_shared/voiceConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, name, email, phone, message, source, attribution } = await req.json();

    if (!organizationId || !name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the first lead stage for this org
    const { data: stages } = await supabaseAdmin
      .from("lead_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true })
      .limit(1);

    const stageId = stages?.[0]?.id || null;

    // Get an org member for created_by (required NOT NULL column)
    const { data: members } = await supabaseAdmin
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

    const finalSource = source || "website";
    const consent_voice_call = resolveVoiceConsent({
      source: finalSource,
      explicit: typeof (await Promise.resolve(null)) === "boolean" ? null : null,
      hasPhone: !!phone,
    });

    // Insert lead
    const { data: lead, error } = await supabaseAdmin.from("leads").insert({
      organization_id: organizationId,
      name: name,
      email: email || null,
      phone: phone || null,
      notes: message ? `[Site] ${message}` : null,
      source: finalSource,
      lead_stage_id: stageId,
      created_by: createdBy,
      consent_voice_call,
      attribution_context: attribution || {},
      traffic_source: attribution?.utm_source || attribution?.utm_campaign || null,
      conversion_identifier: attribution?.utm_content || attribution?.utm_term || null,
    }).select().single();

    if (error) throw error;

    // Trigger platform alert
    if (lead) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/platform-alerts`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "lead",
            data: {
              ...lead,
              organization_id: organizationId
            },
            attribution: attribution || {}
          }),
        });
      } catch (alertErr) {
        console.warn("Failed to trigger platform alert:", alertErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("website-lead error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
