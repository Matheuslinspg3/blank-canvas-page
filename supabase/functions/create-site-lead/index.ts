import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id, name, email, phone, message, broker_token, property_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve organization + broker from broker_token if provided
    let resolvedOrgId: string | null = organization_id || null;
    let assignedBroker: string | null = null;
    let shareLinkId: string | null = null;

    if (broker_token) {
      const { data: link } = await supabase
        .from("property_share_links")
        .select("id, broker_id, property_id")
        .eq("broker_token", broker_token)
        .eq("active", true)
        .maybeSingle();
      if (link) {
        assignedBroker = link.broker_id;
        shareLinkId = link.id;
        if (!resolvedOrgId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("user_id", link.broker_id)
            .maybeSingle();
          resolvedOrgId = prof?.organization_id || null;
        }
      }
    }

    if (!resolvedOrgId) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find an admin user for this org to use as created_by
    const { data: members } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("organization_id", resolvedOrgId)
      .limit(1);

    const createdBy = members?.[0]?.user_id;
    if (!createdBy) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the first lead stage for this org
    const { data: stages } = await supabase
      .from("lead_stages")
      .select("id")
      .eq("organization_id", resolvedOrgId)
      .order("position", { ascending: true })
      .limit(1);

    const stageId = stages?.[0]?.id || null;

    const noteParts: string[] = [];
    if (message) noteParts.push(`[Site] ${message}`);
    if (shareLinkId) noteParts.push(`[Origem: link compartilhado ${broker_token}]`);

    const leadPayload: Record<string, unknown> = {
      name: name || "Visitante do site",
      email: email || null,
      phone: phone || null,
      notes: noteParts.length ? noteParts.join("\n") : null,
      source: broker_token ? "landing_page" : "site",
      organization_id: resolvedOrgId,
      lead_stage_id: stageId,
      created_by: createdBy,
    };
    if (assignedBroker) {
      leadPayload.broker_id = assignedBroker;
      leadPayload.assigned_to = assignedBroker;
    }
    if (property_id) leadPayload.property_id = property_id;

    const { error } = await supabase.from("leads").insert(leadPayload);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-site-lead error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
