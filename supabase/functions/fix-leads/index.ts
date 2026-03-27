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
      return new Response(JSON.stringify({ success: true, message: "Nenhum lead encontrado.", fixed: 0, merged: 0, source_updated: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixed = 0;
    let merged = 0;
    let sourceUpdated = 0;

    // 2. Fix source/external_source for leads missing it
    // Leads with "RD Station" in source but no external_source
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

      // Fix source text for RD Station leads
      if (lead.external_source === "rdstation" && !lead.source) {
        updateData.source = "RD Station";
      }
      if (lead.external_source === "meta_ads" && !lead.source) {
        updateData.source = "Meta Ads";
      }

      // Extract conversion_identifier from notes if missing
      if (!lead.conversion_identifier && lead.notes) {
        const match = lead.notes.match(/Anúncio\/Formulário:\s*(.+)/);
        if (match) {
          updateData.conversion_identifier = match[1].trim();
        }
      }

      // Extract traffic_source from notes if missing
      if (!lead.traffic_source && lead.notes) {
        const match = lead.notes.match(/Origem do tráfego:\s*(.+)/);
        if (match) {
          updateData.traffic_source = match[1].trim();
        }
        if (!updateData.traffic_source) {
          const match2 = lead.notes.match(/Origem:\s*(.+)/);
          if (match2) {
            updateData.traffic_source = match2[1].trim();
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from("leads").update(updateData).eq("id", lead.id);
        if (!error) {
          if (updateData.external_source) sourceUpdated++;
          if (updateData.conversion_identifier || updateData.traffic_source) fixed++;
        }
      }
    }

    // 3. Merge duplicates (by email and phone)
    // Group by email
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
          // Use last 8 digits as key
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
      // Keep the first one (oldest by array order which is desc, so last is oldest)
      const keeper = group[group.length - 1];
      for (let i = 0; i < group.length - 1; i++) {
        const dup = group[i];
        if (mergedIds.has(dup.id) || dup.id === keeper.id) continue;

        // Merge missing fields into keeper
        const updateData: Record<string, any> = {};
        if (!keeper.phone && dup.phone) updateData.phone = dup.phone;
        if (!keeper.conversion_identifier && dup.conversion_identifier) updateData.conversion_identifier = dup.conversion_identifier;
        if (!keeper.traffic_source && dup.traffic_source) updateData.traffic_source = dup.traffic_source;
        if (!keeper.external_id && dup.external_id) updateData.external_id = dup.external_id;
        if (!keeper.external_source && dup.external_source) updateData.external_source = dup.external_source;

        if (Object.keys(updateData).length > 0) {
          await supabase.from("leads").update(updateData).eq("id", keeper.id);
          // Update keeper in memory
          Object.assign(keeper, updateData);
        }

        // Deactivate duplicate
        await supabase.from("leads").update({ is_active: false, notes: `${dup.notes || ""}\n[Mesclado com lead ${keeper.id}]`.trim() }).eq("id", dup.id);

        // Move interactions to keeper
        await supabase.from("lead_interactions").update({ lead_id: keeper.id }).eq("lead_id", dup.id);

        mergedIds.add(dup.id);
        merged++;
      }
    }

    // Merge phone duplicates (only if not already merged)
    for (const [_, group] of Object.entries(byPhone)) {
      // Filter out already merged leads
      const active = group.filter(l => !mergedIds.has(l.id));
      if (active.length <= 1) continue;

      const keeper = active[active.length - 1];
      for (let i = 0; i < active.length - 1; i++) {
        const dup = active[i];
        if (mergedIds.has(dup.id) || dup.id === keeper.id) continue;
        // Only merge if they share the same email or one has no email
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
      JSON.stringify({ success: true, fixed, merged, source_updated: sourceUpdated, total_analyzed: leads.length }),
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
