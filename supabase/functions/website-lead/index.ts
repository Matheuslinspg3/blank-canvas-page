import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, name, email, phone, message, source } = await req.json();

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

    // Get the first lead stage for this org (or create a default)
    const { data: stages } = await supabaseAdmin
      .from("lead_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .order("order_index", { ascending: true })
      .limit(1);

    const stageId = stages?.[0]?.id || null;

    // Insert lead
    const { error } = await supabaseAdmin.from("leads").insert({
      organization_id: organizationId,
      name: name,
      email: email || null,
      phone: phone || null,
      notes: message ? `[Site] ${message}` : null,
      source: source || "website",
      stage_id: stageId,
      created_by: null,
    });

    if (error) throw error;

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
