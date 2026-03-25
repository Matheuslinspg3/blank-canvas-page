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

    // Get RD Station settings
    const { data: settings } = await supabase
      .from("rd_station_settings")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    if (!settings?.oauth_access_token) {
      return new Response(
        JSON.stringify({ error: "OAuth não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = settings.oauth_access_token;

    // Refresh token if expired
    if (settings.oauth_token_expires_at && new Date(settings.oauth_token_expires_at) < new Date()) {
      const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
      const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");
      if (!clientId || !clientSecret || !settings.oauth_refresh_token) {
        return new Response(JSON.stringify({ error: "Token expirado." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refreshRes = await fetch("https://api.rd.services/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: settings.oauth_refresh_token,
        }),
      });
      if (!refreshRes.ok) {
        return new Response(JSON.stringify({ error: "Falha ao renovar token." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;
      await supabase.from("rd_station_settings").update({
        oauth_access_token: refreshData.access_token,
        oauth_refresh_token: refreshData.refresh_token || settings.oauth_refresh_token,
        oauth_token_expires_at: new Date(Date.now() + (refreshData.expires_in || 86400) * 1000).toISOString(),
      }).eq("organization_id", orgId);
    }

    // Get leads missing phone, from RD Station source
    const { data: leadsWithoutPhone } = await supabase
      .from("leads")
      .select("id, email, name, external_id")
      .eq("organization_id", orgId)
      .eq("external_source", "rdstation")
      .is("phone", null);

    if (!leadsWithoutPhone || leadsWithoutPhone.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum lead sem telefone encontrado.", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[backfill] Found ${leadsWithoutPhone.length} leads without phone`);

    const apiHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    // Get segmentations
    const segRes = await fetch("https://api.rd.services/platform/segmentations", { headers: apiHeaders });
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

    // Build lookup maps
    const emailMap = new Map<string, typeof leadsWithoutPhone[0]>();
    const extIdMap = new Map<string, typeof leadsWithoutPhone[0]>();
    for (const lead of leadsWithoutPhone) {
      if (lead.email) emailMap.set(lead.email.toLowerCase(), lead);
      if (lead.external_id) extIdMap.set(lead.external_id, lead);
    }

    // Paginate RD contacts and match
    let updated = 0;
    let page = 1;
    const pageSize = 125;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const url = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
      const res = await fetch(url, { headers: apiHeaders });
      if (!res.ok) break;
      const data = await res.json();
      const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);
      if (contacts.length === 0) break;

      for (const contact of contacts) {
        const phone = contact.personal_phone || contact.mobile_phone || contact.phone || contact.cellphone || extractPhone(contact) || null;
        if (!phone) continue;

        let matchedLead: typeof leadsWithoutPhone[0] | undefined;

        // Match by external_id (uuid)
        if (contact.uuid && extIdMap.has(contact.uuid)) {
          matchedLead = extIdMap.get(contact.uuid);
        }

        // Match by email
        if (!matchedLead && contact.email) {
          matchedLead = emailMap.get(contact.email.toLowerCase());
        }

        if (matchedLead) {
          const { error: updateErr } = await supabase
            .from("leads")
            .update({ phone })
            .eq("id", matchedLead.id);
          if (!updateErr) {
            updated++;
            // Remove from maps so we don't update twice
            if (matchedLead.email) emailMap.delete(matchedLead.email.toLowerCase());
            if (matchedLead.external_id) extIdMap.delete(matchedLead.external_id);
          }
        }
      }

      hasMore = typeof data?.has_more === "boolean" ? data.has_more : contacts.length >= pageSize;
      page++;
    }

    console.log(`[backfill] Updated ${updated} leads with phone numbers`);

    return new Response(
      JSON.stringify({ success: true, updated, total_without_phone: leadsWithoutPhone.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Backfill error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractPhone(contact: any): string | null {
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
