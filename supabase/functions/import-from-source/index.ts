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
    const { action, target_organization_id, target_user_id, source_organization_id, offset = 0, page_size = 50 } = body;

    const source = createClient(sourceUrl, sourceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const dest = createClient(destUrl, destKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ── ACTION: list_orgs ──
    if (action === "list_orgs") {
      const { data, error } = await source.from("organizations").select("id, name, type, slug");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, organizations: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: count_source ──
    if (action === "count_source") {
      const orgId = source_organization_id;
      const [props, leads, images, stages, types, ltypes, interactions] = await Promise.all([
        source.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("property_images").select("id", { count: "exact", head: true }).in("property_id",
          (await source.from("properties").select("id").eq("organization_id", orgId)).data?.map((p: any) => p.id) || []),
        source.from("lead_stages").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("property_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("lead_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        source.from("lead_interactions").select("id", { count: "exact", head: true }),
      ]);
      return new Response(JSON.stringify({
        success: true,
        counts: {
          properties: props.count || 0, leads: leads.count || 0,
          property_images: images.count || 0, lead_stages: stages.count || 0,
          property_types: types.count || 0, lead_types: ltypes.count || 0,
          lead_interactions: interactions.count || 0,
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!target_organization_id || !target_user_id || !source_organization_id) {
      throw new Error("target_organization_id, target_user_id e source_organization_id obrigatórios");
    }

    // ── ACTION: import_config (stages, types) ──
    if (action === "import_config") {
      const result = { property_types: 0, lead_stages: 0, lead_types: 0, maps: { propertyTypeMap: {} as Record<string,string>, leadStageMap: {} as Record<string,string>, leadTypeMap: {} as Record<string,string> } };

      // Property types
      const { data: srcPT } = await source.from("property_types").select("*").eq("organization_id", source_organization_id);
      for (const pt of srcPT || []) {
        const { data: ex } = await dest.from("property_types").select("id").eq("organization_id", target_organization_id).eq("name", pt.name).maybeSingle();
        if (ex) { result.maps.propertyTypeMap[pt.id] = ex.id; }
        else {
          const { data: c } = await dest.from("property_types").insert({ name: pt.name, organization_id: target_organization_id }).select("id").single();
          if (c) { result.maps.propertyTypeMap[pt.id] = c.id; result.property_types++; }
        }
      }

      // Lead stages
      const { data: srcLS } = await source.from("lead_stages").select("*").eq("organization_id", source_organization_id);
      for (const ls of srcLS || []) {
        const { data: ex } = await dest.from("lead_stages").select("id").eq("organization_id", target_organization_id).eq("name", ls.name).maybeSingle();
        if (ex) { result.maps.leadStageMap[ls.id] = ex.id; }
        else {
          const { data: c } = await dest.from("lead_stages").insert({ name: ls.name, color: ls.color, position: ls.position, is_win: ls.is_win, is_loss: ls.is_loss, organization_id: target_organization_id, is_default: false }).select("id").single();
          if (c) { result.maps.leadStageMap[ls.id] = c.id; result.lead_stages++; }
        }
      }

      // Lead types
      const { data: srcLT } = await source.from("lead_types").select("*").eq("organization_id", source_organization_id);
      for (const lt of srcLT || []) {
        const { data: ex } = await dest.from("lead_types").select("id").eq("organization_id", target_organization_id).eq("name", lt.name).maybeSingle();
        if (ex) { result.maps.leadTypeMap[lt.id] = ex.id; }
        else {
          const { data: c } = await dest.from("lead_types").insert({ name: lt.name, color: lt.color, organization_id: target_organization_id, is_default: false }).select("id").single();
          if (c) { result.maps.leadTypeMap[lt.id] = c.id; result.lead_types++; }
        }
      }

      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: import_properties ──
    if (action === "import_properties") {
      const propertyTypeMap: Record<string,string> = body.property_type_map || {};
      const { data: srcProps, error: e1 } = await source.from("properties").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);

      if (e1) throw e1;
      
      let imported = 0, skipped = 0;
      const errors: string[] = [];
      const idMap: Record<string,string> = {};

      for (const prop of srcProps || []) {
        const { data: ex } = await dest.from("properties").select("id").eq("organization_id", target_organization_id)
          .eq("source_property_id", prop.id).maybeSingle();
        if (ex) { idMap[prop.id] = ex.id; skipped++; continue; }

        const { data: c, error: e2 } = await dest.from("properties").insert({
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
        }).select("id").single();

        if (c) { idMap[prop.id] = c.id; imported++; }
        else errors.push(`${prop.title || prop.id}: ${e2?.message}`);
      }

      // Import images for these properties
      let images_imported = 0;
      const oldIds = Object.keys(idMap);
      if (oldIds.length > 0) {
        const { data: srcImages } = await source.from("property_images").select("*")
          .in("property_id", oldIds).order("display_order", { ascending: true });

        for (const img of srcImages || []) {
          const newPropId = idMap[img.property_id];
          if (!newPropId) continue;
          const { error: e3 } = await dest.from("property_images").insert({
            property_id: newPropId, url: img.url, is_cover: img.is_cover,
            display_order: img.display_order, image_type: img.image_type, source: img.source,
            r2_key_full: img.r2_key_full, r2_key_thumb: img.r2_key_thumb,
            storage_provider: img.storage_provider, cached_thumbnail_url: img.cached_thumbnail_url,
          });
          if (!e3) images_imported++;
        }
      }

      const has_more = (srcProps?.length || 0) >= page_size;
      return new Response(JSON.stringify({ success: true, imported, skipped, errors, images_imported, id_map: idMap, has_more, next_offset: offset + page_size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: import_leads ──
    if (action === "import_leads") {
      const leadStageMap: Record<string,string> = body.lead_stage_map || {};
      const leadTypeMap: Record<string,string> = body.lead_type_map || {};
      const propertyIdMap: Record<string,string> = body.property_id_map || {};

      const { data: srcLeads, error: e1 } = await source.from("leads").select("*")
        .eq("organization_id", source_organization_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + page_size - 1);

      if (e1) throw e1;

      let imported = 0, skipped = 0;
      const errors: string[] = [];
      const idMap: Record<string,string> = {};

      for (const lead of srcLeads || []) {
        // Dedup by external_id
        const { data: ex } = await dest.from("leads").select("id")
          .eq("organization_id", target_organization_id)
          .eq("external_id", lead.id).maybeSingle();
        if (ex) { idMap[lead.id] = ex.id; skipped++; continue; }

        const { data: c, error: e2 } = await dest.from("leads").insert({
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
        }).select("id").single();

        if (c) { idMap[lead.id] = c.id; imported++; }
        else errors.push(`${lead.name}: ${e2?.message}`);
      }

      const has_more = (srcLeads?.length || 0) >= page_size;
      return new Response(JSON.stringify({ success: true, imported, skipped, errors, id_map: idMap, has_more, next_offset: offset + page_size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("action inválida. Use: list_orgs, count_source, import_config, import_properties, import_leads");
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
