import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub;
    if (!userId || (payload.exp && payload.exp < Math.floor(Date.now() / 1000))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

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

    // Parse body
    let body: any = {};
    try { body = await req.json(); } catch {}

    const mode = body.mode || "sync"; // "sync" (default, legacy) | "preview" | "import"
    const daysBack = Math.min(body.days_back || 7, 90);
    const selectedLeadIds: string[] = body.selected_lead_ids || [];
    const crmStageId: string | null = body.crm_stage_id || null;

    // ── IMPORT MODE ──
    if (mode === "import") {
      if (!selectedLeadIds.length) {
        return new Response(JSON.stringify({ error: "No leads selected" }), { status: 400, headers: corsHeaders });
      }

      // Get leads from ad_leads that match
      const { data: adLeads } = await supabase
        .from("ad_leads")
        .select("*")
        .eq("organization_id", orgId)
        .in("id", selectedLeadIds)
        .eq("status", "new");

      let imported = 0;
      let skipped = 0;

      for (const nl of (adLeads || [])) {
        // Dedup by email/phone
        let existingCrmLead: any = null;

        if (nl.email) {
          const { data: byEmail } = await supabase
            .from("leads")
            .select("id")
            .eq("organization_id", orgId)
            .eq("email", nl.email)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (byEmail) existingCrmLead = byEmail;
        }

        if (!existingCrmLead && nl.phone) {
          const normalizedPhone = nl.phone.replace(/\D/g, "");
          if (normalizedPhone.length >= 8) {
            const { data: allLeads } = await supabase
              .from("leads")
              .select("id, phone")
              .eq("organization_id", orgId)
              .eq("is_active", true)
              .not("phone", "is", null);
            const match = (allLeads || []).find((l: any) => {
              const lPhone = (l.phone || "").replace(/\D/g, "");
              return lPhone.length >= 8 && (lPhone === normalizedPhone || lPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(lPhone));
            });
            if (match) existingCrmLead = match;
          }
        }

        if (existingCrmLead) {
          await supabase.from("ad_leads").update({
            status: "sent_to_crm",
            crm_record_id: existingCrmLead.id,
            updated_at: new Date().toISOString(),
          }).eq("id", nl.id);
          skipped++;
          continue;
        }

        const { data: crmLead, error: crmError } = await supabase
          .from("leads")
          .insert({
            name: nl.name || "Lead de Anúncio",
            email: nl.email,
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
          await supabase.from("ad_leads").update({
            status: "sent_to_crm",
            crm_record_id: crmLead.id,
            updated_at: new Date().toISOString(),
          }).eq("id", nl.id);
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

    // ── PREVIEW & SYNC MODES ── fetch from Meta, save to ad_leads
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    // Step 1: Get Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("[meta-sync-leads] Meta API error (pages):", JSON.stringify(pagesData.error));
      return new Response(JSON.stringify({ error: "Meta API error", details: pagesData.error.message }), { status: 502, headers: corsHeaders });
    }

    const pages = pagesData.data || [];
    if (pages.length === 0) {
      const emptyResult = mode === "preview"
        ? { leads: [], message: "Nenhuma página encontrada. Verifique as permissões do token." }
        : { synced: 0, skipped: 0, auto_sent: 0, forms: 0, message: "Nenhuma página encontrada." };
      return new Response(JSON.stringify(emptyResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // ── SYNC MODE: auto-send to CRM ──
    if (mode === "sync") {
      const { data: adSettings } = await supabase
        .from("ad_settings")
        .select("auto_send_to_crm, crm_stage_id")
        .eq("organization_id", orgId)
        .single();

      let autoSent = 0;
      if (adSettings?.auto_send_to_crm && adSettings?.crm_stage_id) {
        const { data: newLeads } = await supabase
          .from("ad_leads")
          .select("id, name, email, phone, external_ad_id")
          .eq("organization_id", orgId)
          .eq("status", "new");

        for (const nl of (newLeads || [])) {
          let existingCrmLead: any = null;
          if (nl.email) {
            const { data: byEmail } = await supabase
              .from("leads").select("id")
              .eq("organization_id", orgId).eq("email", nl.email).eq("is_active", true)
              .limit(1).maybeSingle();
            if (byEmail) existingCrmLead = byEmail;
          }
          if (!existingCrmLead && nl.phone) {
            const normalizedPhone = nl.phone.replace(/\D/g, "");
            if (normalizedPhone.length >= 8) {
              const { data: allCrmLeads } = await supabase
                .from("leads").select("id, phone")
                .eq("organization_id", orgId).eq("is_active", true).not("phone", "is", null);
              const match = (allCrmLeads || []).find((l: any) => {
                const lPhone = (l.phone || "").replace(/\D/g, "");
                return lPhone.length >= 8 && (lPhone === normalizedPhone || lPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(lPhone));
              });
              if (match) existingCrmLead = match;
            }
          }
          if (existingCrmLead) {
            await supabase.from("ad_leads").update({ status: "sent_to_crm", crm_record_id: existingCrmLead.id, updated_at: new Date().toISOString() }).eq("id", nl.id);
            autoSent++;
            continue;
          }
          const { data: crmLead, error: crmError } = await supabase
            .from("leads")
            .insert({ name: nl.name || "Lead de Anúncio", email: nl.email, phone: nl.phone, organization_id: orgId, created_by: userId, lead_stage_id: adSettings.crm_stage_id, stage: "novo", source: "anuncio", notes: `Lead importado automaticamente de Meta Ads (Ad ID: ${nl.external_ad_id})` })
            .select("id").single();
          if (!crmError && crmLead) {
            await supabase.from("ad_leads").update({ status: "sent_to_crm", crm_record_id: crmLead.id, updated_at: new Date().toISOString() }).eq("id", nl.id);
            autoSent++;
          }
        }
      }

      return new Response(
        JSON.stringify({ synced: totalSynced, skipped: totalSkipped, auto_sent: autoSent, forms: totalForms, pages: pages.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PREVIEW MODE: return leads for selection ──
    const newLeads = allLeads.filter((l: any) => l.status === "new");
    return new Response(
      JSON.stringify({ leads: newLeads, total: newLeads.length, pages: pages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
