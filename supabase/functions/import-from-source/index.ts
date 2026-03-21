import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin only (admin_allowlist)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Verify admin access
    const adminCheck = createClient(supabaseUrl, serviceKey);
    const { data: allowed } = await adminCheck.from("admin_allowlist").select("id").eq("email", authUser.email!).maybeSingle();
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceUrl = Deno.env.get("SOURCE_SUPABASE_URL");
    const sourceKey = Deno.env.get("SOURCE_SUPABASE_SERVICE_ROLE_KEY");
    const destUrl = Deno.env.get("SUPABASE_URL");
    const destKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!sourceUrl || !sourceKey) throw new Error("SOURCE credentials missing");
    if (!destUrl || !destKey) throw new Error("DEST credentials missing");

    const body = await req.json();
    const { action, target_organization_id, target_user_id, source_organization_id, offset = 0, page_size = 30 } = body;

    const source = createClient(sourceUrl, sourceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const dest = createClient(destUrl, destKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ── ACTION: list_orgs ──
    if (action === "list_orgs") {
      const { data, error } = await source.from("organizations").select("id, name, type, slug");
      if (error) throw error;
      return json({ success: true, organizations: data });
    }

    // ── ACTION: count_source ──
    if (action === "count_source") {
      const orgId = source_organization_id;
      const tables = ["properties","leads","lead_stages","property_types","lead_types","lead_interactions","contracts","commissions","transactions","invoices","appointments","activity_log","transaction_categories"];
      const counts: Record<string,number> = {};
      await Promise.all(tables.map(async (t) => {
        const { count } = await source.from(t).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
        counts[t] = count || 0;
      }));
      return json({ success: true, counts });
    }

    if (!target_organization_id || !target_user_id || !source_organization_id) {
      throw new Error("target_organization_id, target_user_id e source_organization_id obrigatórios");
    }

    // ── ACTION: import_config ──
    if (action === "import_config") {
      const maps = { propertyTypeMap: {} as Record<string,string>, leadStageMap: {} as Record<string,string>, leadTypeMap: {} as Record<string,string>, categoryMap: {} as Record<string,string> };
      let pt_count = 0, ls_count = 0, lt_count = 0, cat_count = 0;

      const [srcPT, srcLS, srcLT, srcCat, existPT, existLS, existLT, existCat] = await Promise.all([
        source.from("property_types").select("*").eq("organization_id", source_organization_id),
        source.from("lead_stages").select("*").eq("organization_id", source_organization_id),
        source.from("lead_types").select("*").eq("organization_id", source_organization_id),
        source.from("transaction_categories").select("*").eq("organization_id", source_organization_id),
        dest.from("property_types").select("id, name").eq("organization_id", target_organization_id),
        dest.from("lead_stages").select("id, name").eq("organization_id", target_organization_id),
        dest.from("lead_types").select("id, name").eq("organization_id", target_organization_id),
        dest.from("transaction_categories").select("id, name").eq("organization_id", target_organization_id),
      ]);

      const existPTMap = new Map((existPT.data || []).map(x => [x.name, x.id]));
      const existLSMap = new Map((existLS.data || []).map(x => [x.name, x.id]));
      const existLTMap = new Map((existLT.data || []).map(x => [x.name, x.id]));
      const existCatMap = new Map((existCat.data || []).map(x => [x.name, x.id]));

      for (const pt of srcPT.data || []) {
        if (existPTMap.has(pt.name)) { maps.propertyTypeMap[pt.id] = existPTMap.get(pt.name)!; }
        else {
          const { data: c } = await dest.from("property_types").insert({ name: pt.name, organization_id: target_organization_id }).select("id").single();
          if (c) { maps.propertyTypeMap[pt.id] = c.id; pt_count++; }
        }
      }
      for (const ls of srcLS.data || []) {
        if (existLSMap.has(ls.name)) { maps.leadStageMap[ls.id] = existLSMap.get(ls.name)!; }
        else {
          const { data: c } = await dest.from("lead_stages").insert({ name: ls.name, color: ls.color, position: ls.position, is_win: ls.is_win, is_loss: ls.is_loss, organization_id: target_organization_id, is_default: false }).select("id").single();
          if (c) { maps.leadStageMap[ls.id] = c.id; ls_count++; }
        }
      }
      for (const lt of srcLT.data || []) {
        if (existLTMap.has(lt.name)) { maps.leadTypeMap[lt.id] = existLTMap.get(lt.name)!; }
        else {
          const { data: c } = await dest.from("lead_types").insert({ name: lt.name, color: lt.color, organization_id: target_organization_id, is_default: false }).select("id").single();
          if (c) { maps.leadTypeMap[lt.id] = c.id; lt_count++; }
        }
      }
      for (const cat of srcCat.data || []) {
        if (existCatMap.has(cat.name)) { maps.categoryMap[cat.id] = existCatMap.get(cat.name)!; }
        else {
          const { data: c } = await dest.from("transaction_categories").insert({ name: cat.name, organization_id: target_organization_id }).select("id").single();
          if (c) { maps.categoryMap[cat.id] = c.id; cat_count++; }
        }
      }

      return json({ success: true, result: { property_types: pt_count, lead_stages: ls_count, lead_types: lt_count, transaction_categories: cat_count, maps } });
    }

    // ── ACTION: import_properties (batch) ──
    if (action === "import_properties") {
      const propertyTypeMap: Record<string,string> = body.property_type_map || {};
      const { data: srcProps, error: e1 } = await source.from("properties").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcProps || srcProps.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], images_imported: 0, id_map: {}, has_more: false });

      const srcIds = srcProps.map(p => p.id);
      const { data: existing } = await dest.from("properties").select("id, source_property_id")
        .eq("organization_id", target_organization_id).in("source_property_id", srcIds);
      const existingMap = new Map((existing || []).map(e => [e.source_property_id, e.id]));

      const toInsert = []; const idMap: Record<string,string> = {}; let skipped = 0;
      for (const prop of srcProps) {
        if (existingMap.has(prop.id)) { idMap[prop.id] = existingMap.get(prop.id)!; skipped++; continue; }
        toInsert.push({
          organization_id: target_organization_id, created_by: target_user_id,
          title: prop.title, description: prop.description, transaction_type: prop.transaction_type,
          sale_price: prop.sale_price, rent_price: prop.rent_price, condominium_fee: prop.condominium_fee,
          iptu: prop.iptu, status: prop.status || "disponivel", bedrooms: prop.bedrooms, suites: prop.suites,
          bathrooms: prop.bathrooms, parking_spots: prop.parking_spots, area_total: prop.area_total,
          area_built: prop.area_built, area_useful: prop.area_useful, floor: prop.floor,
          address_street: prop.address_street, address_number: prop.address_number,
          address_complement: prop.address_complement, address_neighborhood: prop.address_neighborhood,
          address_city: prop.address_city, address_state: prop.address_state, address_zipcode: prop.address_zipcode,
          latitude: prop.latitude, longitude: prop.longitude, amenities: prop.amenities, featured: prop.featured,
          property_code: prop.property_code, property_condition: prop.property_condition,
          launch_stage: prop.launch_stage, development_name: prop.development_name,
          commission_value: prop.commission_value, commission_type: prop.commission_type,
          youtube_url: prop.youtube_url, payment_options: prop.payment_options,
          sale_price_financed: prop.sale_price_financed, beach_distance_meters: prop.beach_distance_meters,
          iptu_monthly: prop.iptu_monthly, inspection_fee: prop.inspection_fee,
          source_provider: "import", source_property_id: prop.id,
          property_type_id: prop.property_type_id ? propertyTypeMap[prop.property_type_id] || null : null,
        });
      }

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("properties").insert(toInsert).select("id, source_property_id");
        if (e2) errors.push(e2.message);
        else if (created) { imported = created.length; for (const c of created) { if (c.source_property_id) idMap[c.source_property_id] = c.id; } }
      }

      let images_imported = 0;
      const newPropOldIds = Object.keys(idMap).filter(k => !existingMap.has(k));
      if (newPropOldIds.length > 0) {
        const { data: srcImages } = await source.from("property_images").select("*").in("property_id", newPropOldIds).order("display_order", { ascending: true });
        if (srcImages && srcImages.length > 0) {
          const imgInsert = srcImages.map(img => ({
            property_id: idMap[img.property_id], url: img.url, is_cover: img.is_cover, display_order: img.display_order,
            image_type: img.image_type, source: img.source, r2_key_full: img.r2_key_full, r2_key_thumb: img.r2_key_thumb,
            storage_provider: img.storage_provider, cached_thumbnail_url: img.cached_thumbnail_url,
          })).filter(i => i.property_id);
          if (imgInsert.length > 0) {
            const { error: e3, data: imgCreated } = await dest.from("property_images").insert(imgInsert).select("id");
            if (!e3 && imgCreated) images_imported = imgCreated.length;
            if (e3) errors.push(`images: ${e3.message}`);
          }
        }
      }

      const has_more = srcProps.length >= page_size;
      return json({ success: true, imported, skipped, errors, images_imported, id_map: idMap, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_leads (batch) ──
    if (action === "import_leads") {
      const leadStageMap: Record<string,string> = body.lead_stage_map || {};
      const leadTypeMap: Record<string,string> = body.lead_type_map || {};
      const propertyIdMap: Record<string,string> = body.property_id_map || {};

      const { data: srcLeads, error: e1 } = await source.from("leads").select("*")
        .eq("organization_id", source_organization_id).order("created_at", { ascending: true }).range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcLeads || srcLeads.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], id_map: {}, has_more: false });

      const srcIds = srcLeads.map(l => l.id);
      const { data: existing } = await dest.from("leads").select("id, external_id").eq("organization_id", target_organization_id).in("external_id", srcIds);
      const existingMap = new Map((existing || []).map(e => [e.external_id, e.id]));

      const toInsert = []; const idMap: Record<string,string> = {}; let skipped = 0;
      for (const lead of srcLeads) {
        if (existingMap.has(lead.id)) { idMap[lead.id] = existingMap.get(lead.id)!; skipped++; continue; }
        toInsert.push({
          organization_id: target_organization_id, created_by: target_user_id,
          name: lead.name, email: lead.email, phone: lead.phone,
          stage: lead.stage || "novo", estimated_value: lead.estimated_value,
          source: lead.source, notes: lead.notes, is_active: lead.is_active,
          temperature: lead.temperature, transaction_interest: lead.transaction_interest,
          min_bedrooms: lead.min_bedrooms, max_bedrooms: lead.max_bedrooms,
          min_area: lead.min_area, max_area: lead.max_area,
          preferred_neighborhoods: lead.preferred_neighborhoods, preferred_cities: lead.preferred_cities,
          additional_requirements: lead.additional_requirements,
          external_source: "import", external_id: lead.id, position: lead.position, score: lead.score,
          lead_stage_id: lead.lead_stage_id ? leadStageMap[lead.lead_stage_id] || null : null,
          lead_type_id: lead.lead_type_id ? leadTypeMap[lead.lead_type_id] || null : null,
          property_id: lead.property_id ? propertyIdMap[lead.property_id] || null : null,
        });
      }

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("leads").insert(toInsert).select("id, external_id");
        if (e2) errors.push(e2.message);
        else if (created) { imported = created.length; for (const c of created) { if (c.external_id) idMap[c.external_id] = c.id; } }
      }

      const has_more = srcLeads.length >= page_size;
      return json({ success: true, imported, skipped, errors, id_map: idMap, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_lead_interactions (batch) ──
    if (action === "import_lead_interactions") {
      const leadIdMap: Record<string,string> = body.lead_id_map || {};

      const { data: srcItems, error: e1 } = await source.from("lead_interactions").select("*")
        .in("lead_id", Object.keys(leadIdMap))
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(i => ({
        lead_id: leadIdMap[i.lead_id],
        created_by: target_user_id,
        description: i.description,
        type: i.type,
        occurred_at: i.occurred_at,
      })).filter(i => i.lead_id);

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("lead_interactions").insert(toInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, skipped: 0, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_contracts (batch) ──
    if (action === "import_contracts") {
      const propertyIdMap: Record<string,string> = body.property_id_map || {};
      const leadIdMap: Record<string,string> = body.lead_id_map || {};

      const { data: srcItems, error: e1 } = await source.from("contracts").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], id_map: {}, has_more: false });

      // Check existing by code
      const codes = srcItems.map(c => c.code);
      const { data: existing } = await dest.from("contracts").select("id, code").eq("organization_id", target_organization_id).in("code", codes);
      const existingMap = new Map((existing || []).map(e => [e.code, e.id]));

      const toInsert = []; const idMap: Record<string,string> = {}; let skipped = 0;
      for (const c of srcItems) {
        if (existingMap.has(c.code)) { idMap[c.id] = existingMap.get(c.code)!; skipped++; continue; }
        toInsert.push({
          organization_id: target_organization_id, created_by: target_user_id,
          code: c.code, type: c.type, value: c.value, status: c.status,
          start_date: c.start_date, end_date: c.end_date,
          commission_percentage: c.commission_percentage,
          payment_day: c.payment_day, readjustment_index: c.readjustment_index,
          notes: c.notes,
          property_id: c.property_id ? propertyIdMap[c.property_id] || null : null,
          lead_id: c.lead_id ? leadIdMap[c.lead_id] || null : null,
          broker_id: null, // can't map brokers across projects
          _src_id: c.id,
        });
      }

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const cleanInsert = toInsert.map(({ _src_id, ...rest }) => rest);
        const { data: created, error: e2 } = await dest.from("contracts").insert(cleanInsert).select("id, code");
        if (e2) errors.push(e2.message);
        else if (created) {
          imported = created.length;
          // Map old id -> new id using code
          const codeToOldId = new Map(srcItems.map(c => [c.code, c.id]));
          for (const c of created) { const oldId = codeToOldId.get(c.code); if (oldId) idMap[oldId] = c.id; }
        }
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, skipped, errors, id_map: idMap, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_commissions (batch) ──
    if (action === "import_commissions") {
      const contractIdMap: Record<string,string> = body.contract_id_map || {};

      const { data: srcItems, error: e1 } = await source.from("commissions").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(c => ({
        organization_id: target_organization_id,
        contract_id: contractIdMap[c.contract_id] || c.contract_id,
        broker_id: target_user_id, // assign to importer since we can't map brokers
        amount: c.amount, percentage: c.percentage, paid: c.paid, paid_at: c.paid_at,
      })).filter(c => contractIdMap[c.contract_id] || false);

      // Re-filter to only those with valid mapped contract_id
      const validInsert = srcItems.filter(c => contractIdMap[c.contract_id]).map(c => ({
        organization_id: target_organization_id,
        contract_id: contractIdMap[c.contract_id],
        broker_id: target_user_id,
        amount: c.amount, percentage: c.percentage, paid: c.paid, paid_at: c.paid_at,
      }));

      let imported = 0; const errors: string[] = [];
      if (validInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("commissions").insert(validInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_transactions (batch) ──
    if (action === "import_transactions") {
      const contractIdMap: Record<string,string> = body.contract_id_map || {};
      const categoryMap: Record<string,string> = body.category_map || {};

      const { data: srcItems, error: e1 } = await source.from("transactions").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(t => ({
        organization_id: target_organization_id, created_by: target_user_id,
        amount: t.amount, type: t.type, date: t.date, description: t.description,
        notes: t.notes, paid: t.paid, paid_at: t.paid_at,
        contract_id: t.contract_id ? contractIdMap[t.contract_id] || null : null,
        category_id: t.category_id ? categoryMap[t.category_id] || null : null,
      }));

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("transactions").insert(toInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_invoices (batch) ──
    if (action === "import_invoices") {
      const contractIdMap: Record<string,string> = body.contract_id_map || {};
      const leadIdMap: Record<string,string> = body.lead_id_map || {};

      const { data: srcItems, error: e1 } = await source.from("invoices").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(i => ({
        organization_id: target_organization_id, created_by: target_user_id,
        amount: i.amount, description: i.description, due_date: i.due_date,
        status: i.status, notes: i.notes, paid_at: i.paid_at,
        contract_id: i.contract_id ? contractIdMap[i.contract_id] || null : null,
        lead_id: i.lead_id ? leadIdMap[i.lead_id] || null : null,
      }));

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("invoices").insert(toInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_appointments (batch) ──
    if (action === "import_appointments") {
      const leadIdMap: Record<string,string> = body.lead_id_map || {};
      const propertyIdMap: Record<string,string> = body.property_id_map || {};

      const { data: srcItems, error: e1 } = await source.from("appointments").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(a => ({
        organization_id: target_organization_id, created_by: target_user_id,
        title: a.title, description: a.description, location: a.location,
        start_time: a.start_time, end_time: a.end_time, completed: a.completed,
        assigned_to: target_user_id,
        lead_id: a.lead_id ? leadIdMap[a.lead_id] || null : null,
        property_id: a.property_id ? propertyIdMap[a.property_id] || null : null,
      }));

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("appointments").insert(toInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: import_activity_log (batch) ──
    if (action === "import_activity_log") {
      const { data: srcItems, error: e1 } = await source.from("activity_log").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcItems || srcItems.length === 0) return json({ success: true, imported: 0, errors: [], has_more: false });

      const toInsert = srcItems.map(a => ({
        organization_id: target_organization_id, user_id: target_user_id,
        action_type: a.action_type, entity_type: a.entity_type,
        entity_id: a.entity_id, entity_name: a.entity_name,
        metadata: a.metadata,
      }));

      let imported = 0; const errors: string[] = [];
      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("activity_log").insert(toInsert).select("id");
        if (e2) errors.push(e2.message);
        else if (created) imported = created.length;
      }

      const has_more = srcItems.length >= page_size;
      return json({ success: true, imported, errors, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: query_lead_brokers ──
    if (action === "query_lead_brokers") {
      const { data: srcLeads } = await source.from("leads").select("id, broker_id, name")
        .eq("organization_id", source_organization_id)
        .not("broker_id", "is", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (!srcLeads || srcLeads.length === 0) return json({ success: true, leads: [], has_more: false });
      const has_more = srcLeads.length >= page_size;
      return json({ success: true, leads: srcLeads, has_more, next_offset: offset + page_size });
    }

    // ── ACTION: query_source_profiles ──
    if (action === "query_source_profiles") {
      const { data: profiles } = await source.from("profiles").select("user_id, full_name, phone")
        .eq("organization_id", source_organization_id);
      return json({ success: true, profiles: profiles || [] });
    }

    throw new Error("action inválida");
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
