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
      const [props, leads, stages, types, ltypes] = await Promise.all([
        source.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("lead_stages").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("property_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("lead_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);
      return json({
        success: true,
        counts: {
          properties: props.count || 0, leads: leads.count || 0,
          lead_stages: stages.count || 0, property_types: types.count || 0, lead_types: ltypes.count || 0,
        }
      });
    }

    if (!target_organization_id || !target_user_id || !source_organization_id) {
      throw new Error("target_organization_id, target_user_id e source_organization_id obrigatórios");
    }

    // ── ACTION: import_config ──
    if (action === "import_config") {
      const maps = { propertyTypeMap: {} as Record<string,string>, leadStageMap: {} as Record<string,string>, leadTypeMap: {} as Record<string,string> };
      let pt_count = 0, ls_count = 0, lt_count = 0;

      const [srcPT, srcLS, srcLT, existPT, existLS, existLT] = await Promise.all([
        source.from("property_types").select("*").eq("organization_id", source_organization_id),
        source.from("lead_stages").select("*").eq("organization_id", source_organization_id),
        source.from("lead_types").select("*").eq("organization_id", source_organization_id),
        dest.from("property_types").select("id, name").eq("organization_id", target_organization_id),
        dest.from("lead_stages").select("id, name").eq("organization_id", target_organization_id),
        dest.from("lead_types").select("id, name").eq("organization_id", target_organization_id),
      ]);

      const existPTMap = new Map((existPT.data || []).map(x => [x.name, x.id]));
      const existLSMap = new Map((existLS.data || []).map(x => [x.name, x.id]));
      const existLTMap = new Map((existLT.data || []).map(x => [x.name, x.id]));

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

      return json({ success: true, result: { property_types: pt_count, lead_stages: ls_count, lead_types: lt_count, maps } });
    }

    // ── ACTION: import_properties (batch) ──
    if (action === "import_properties") {
      const propertyTypeMap: Record<string,string> = body.property_type_map || {};

      // Fetch source page
      const { data: srcProps, error: e1 } = await source.from("properties").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcProps || srcProps.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], images_imported: 0, id_map: {}, has_more: false });

      // Get already imported (by source_property_id) in one query
      const srcIds = srcProps.map(p => p.id);
      const { data: existing } = await dest.from("properties").select("id, source_property_id")
        .eq("organization_id", target_organization_id)
        .in("source_property_id", srcIds);
      const existingMap = new Map((existing || []).map(e => [e.source_property_id, e.id]));

      const toInsert = [];
      const idMap: Record<string,string> = {};
      let skipped = 0;

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
          _src_id: prop.id, // temp field for mapping
        });
      }

      let imported = 0;
      const errors: string[] = [];

      if (toInsert.length > 0) {
        // Remove temp field before insert
        const cleanInsert = toInsert.map(({ _src_id, ...rest }) => rest);
        const { data: created, error: e2 } = await dest.from("properties").insert(cleanInsert).select("id, source_property_id");
        if (e2) {
          errors.push(e2.message);
        } else if (created) {
          imported = created.length;
          for (const c of created) {
            if (c.source_property_id) idMap[c.source_property_id] = c.id;
          }
        }
      }

      // Import images for newly inserted properties
      let images_imported = 0;
      const newPropOldIds = Object.keys(idMap).filter(k => !existingMap.has(k));
      if (newPropOldIds.length > 0) {
        const { data: srcImages } = await source.from("property_images").select("*")
          .in("property_id", newPropOldIds).order("display_order", { ascending: true });

        if (srcImages && srcImages.length > 0) {
          const imgInsert = srcImages.map(img => ({
            property_id: idMap[img.property_id],
            url: img.url, is_cover: img.is_cover, display_order: img.display_order,
            image_type: img.image_type, source: img.source,
            r2_key_full: img.r2_key_full, r2_key_thumb: img.r2_key_thumb,
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
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);
      if (e1) throw e1;
      if (!srcLeads || srcLeads.length === 0) return json({ success: true, imported: 0, skipped: 0, errors: [], id_map: {}, has_more: false });

      // Check existing by external_id
      const srcIds = srcLeads.map(l => l.id);
      const { data: existing } = await dest.from("leads").select("id, external_id")
        .eq("organization_id", target_organization_id)
        .in("external_id", srcIds);
      const existingMap = new Map((existing || []).map(e => [e.external_id, e.id]));

      const toInsert = [];
      const idMap: Record<string,string> = {};
      let skipped = 0;

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

      let imported = 0;
      const errors: string[] = [];

      if (toInsert.length > 0) {
        const { data: created, error: e2 } = await dest.from("leads").insert(toInsert).select("id, external_id");
        if (e2) errors.push(e2.message);
        else if (created) {
          imported = created.length;
          for (const c of created) { if (c.external_id) idMap[c.external_id] = c.id; }
        }
      }

      const has_more = srcLeads.length >= page_size;
      return json({ success: true, imported, skipped, errors, id_map: idMap, has_more, next_offset: offset + page_size });
    }

    throw new Error("action inválida. Use: list_orgs, count_source, import_config, import_properties, import_leads");
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
