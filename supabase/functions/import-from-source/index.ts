import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ImportResult {
  leads_imported: number;
  leads_skipped: number;
  leads_errors: string[];
  properties_imported: number;
  properties_skipped: number;
  properties_errors: string[];
  images_imported: number;
  images_errors: string[];
  lead_stages_imported: number;
  lead_types_imported: number;
  property_types_imported: number;
  lead_interactions_imported: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sourceUrl = Deno.env.get("SOURCE_SUPABASE_URL");
    const sourceKey = Deno.env.get("SOURCE_SUPABASE_SERVICE_ROLE_KEY");
    const destUrl = Deno.env.get("SUPABASE_URL");
    const destKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!sourceUrl || !sourceKey) {
      throw new Error("SOURCE_SUPABASE_URL ou SOURCE_SUPABASE_SERVICE_ROLE_KEY não configurados");
    }
    if (!destUrl || !destKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");
    }

    const body = await req.json();
    const { target_organization_id, target_user_id, source_organization_id, tables } = body;

    if (!target_organization_id || !target_user_id) {
      throw new Error("target_organization_id e target_user_id são obrigatórios");
    }

    const importTables = tables || ["lead_stages", "lead_types", "property_types", "properties", "property_images", "leads", "lead_interactions"];

    const source = createClient(sourceUrl, sourceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const dest = createClient(destUrl, destKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result: ImportResult = {
      leads_imported: 0, leads_skipped: 0, leads_errors: [],
      properties_imported: 0, properties_skipped: 0, properties_errors: [],
      images_imported: 0, images_errors: [],
      lead_stages_imported: 0, lead_types_imported: 0, property_types_imported: 0,
      lead_interactions_imported: 0,
    };

    // Maps from old IDs to new IDs
    const propertyTypeMap = new Map<string, string>();
    const leadStageMap = new Map<string, string>();
    const leadTypeMap = new Map<string, string>();
    const propertyIdMap = new Map<string, string>();
    const leadIdMap = new Map<string, string>();

    // Filter by source org if provided
    const orgFilter = source_organization_id
      ? { organization_id: source_organization_id }
      : {};

    // ── 1. Import property_types ──
    if (importTables.includes("property_types")) {
      const { data: srcTypes, error: e1 } = await source
        .from("property_types").select("*")
        .match(orgFilter);

      if (e1) console.error("Error fetching property_types:", e1.message);

      for (const pt of srcTypes || []) {
        // Check if already exists by name in this org
        const { data: existing } = await dest
          .from("property_types").select("id")
          .eq("organization_id", target_organization_id)
          .eq("name", pt.name)
          .maybeSingle();

        if (existing) {
          propertyTypeMap.set(pt.id, existing.id);
        } else {
          const { data: created, error: e2 } = await dest
            .from("property_types")
            .insert({ name: pt.name, organization_id: target_organization_id })
            .select("id")
            .single();

          if (created) {
            propertyTypeMap.set(pt.id, created.id);
            result.property_types_imported++;
          }
          if (e2) console.error("Error inserting property_type:", e2.message);
        }
      }
    }

    // ── 2. Import lead_stages ──
    if (importTables.includes("lead_stages")) {
      const { data: srcStages, error: e1 } = await source
        .from("lead_stages").select("*")
        .match(orgFilter);

      if (e1) console.error("Error fetching lead_stages:", e1.message);

      for (const ls of srcStages || []) {
        const { data: existing } = await dest
          .from("lead_stages").select("id")
          .eq("organization_id", target_organization_id)
          .eq("name", ls.name)
          .maybeSingle();

        if (existing) {
          leadStageMap.set(ls.id, existing.id);
        } else {
          const { data: created, error: e2 } = await dest
            .from("lead_stages")
            .insert({
              name: ls.name, color: ls.color, position: ls.position,
              is_win: ls.is_win, is_loss: ls.is_loss,
              organization_id: target_organization_id, is_default: false,
            })
            .select("id")
            .single();

          if (created) {
            leadStageMap.set(ls.id, created.id);
            result.lead_stages_imported++;
          }
          if (e2) console.error("Error inserting lead_stage:", e2.message);
        }
      }
    }

    // ── 3. Import lead_types ──
    if (importTables.includes("lead_types")) {
      const { data: srcTypes, error: e1 } = await source
        .from("lead_types").select("*")
        .match(orgFilter);

      if (e1) console.error("Error fetching lead_types:", e1.message);

      for (const lt of srcTypes || []) {
        const { data: existing } = await dest
          .from("lead_types").select("id")
          .eq("organization_id", target_organization_id)
          .eq("name", lt.name)
          .maybeSingle();

        if (existing) {
          leadTypeMap.set(lt.id, existing.id);
        } else {
          const { data: created, error: e2 } = await dest
            .from("lead_types")
            .insert({
              name: lt.name, color: lt.color,
              organization_id: target_organization_id, is_default: false,
            })
            .select("id")
            .single();

          if (created) {
            leadTypeMap.set(lt.id, created.id);
            result.lead_types_imported++;
          }
          if (e2) console.error("Error inserting lead_type:", e2.message);
        }
      }
    }

    // ── 4. Import properties (paginated) ──
    if (importTables.includes("properties")) {
      let offset = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        let query = source.from("properties").select("*");
        if (source_organization_id) {
          query = query.eq("organization_id", source_organization_id);
        }
        const { data: srcProps, error: e1 } = await query
          .range(offset, offset + pageSize - 1)
          .order("created_at", { ascending: true });

        if (e1) {
          console.error("Error fetching properties:", e1.message);
          break;
        }
        if (!srcProps || srcProps.length === 0) { hasMore = false; break; }
        if (srcProps.length < pageSize) hasMore = false;

        for (const prop of srcProps) {
          // Check if already imported (by source_property_id or property_code)
          const { data: existing } = await dest
            .from("properties").select("id")
            .eq("organization_id", target_organization_id)
            .or(`property_code.eq.${prop.property_code},source_property_id.eq.${prop.id}`)
            .maybeSingle();

          if (existing) {
            propertyIdMap.set(prop.id, existing.id);
            result.properties_skipped++;
            continue;
          }

          const newProp: Record<string, unknown> = {
            organization_id: target_organization_id,
            created_by: target_user_id,
            title: prop.title,
            description: prop.description,
            transaction_type: prop.transaction_type,
            sale_price: prop.sale_price,
            rent_price: prop.rent_price,
            condominium_fee: prop.condominium_fee,
            iptu: prop.iptu,
            status: prop.status || "disponivel",
            bedrooms: prop.bedrooms,
            suites: prop.suites,
            bathrooms: prop.bathrooms,
            parking_spots: prop.parking_spots,
            area_total: prop.area_total,
            area_built: prop.area_built,
            area_useful: prop.area_useful,
            floor: prop.floor,
            address_street: prop.address_street,
            address_number: prop.address_number,
            address_complement: prop.address_complement,
            address_neighborhood: prop.address_neighborhood,
            address_city: prop.address_city,
            address_state: prop.address_state,
            address_zipcode: prop.address_zipcode,
            latitude: prop.latitude,
            longitude: prop.longitude,
            amenities: prop.amenities,
            featured: prop.featured,
            property_code: prop.property_code,
            property_condition: prop.property_condition,
            launch_stage: prop.launch_stage,
            development_name: prop.development_name,
            commission_value: prop.commission_value,
            commission_type: prop.commission_type,
            youtube_url: prop.youtube_url,
            payment_options: prop.payment_options,
            sale_price_financed: prop.sale_price_financed,
            beach_distance_meters: prop.beach_distance_meters,
            iptu_monthly: prop.iptu_monthly,
            inspection_fee: prop.inspection_fee,
            source_provider: "import",
            source_property_id: prop.id,
            property_type_id: prop.property_type_id ? propertyTypeMap.get(prop.property_type_id) || null : null,
          };

          const { data: created, error: e2 } = await dest
            .from("properties")
            .insert(newProp)
            .select("id")
            .single();

          if (created) {
            propertyIdMap.set(prop.id, created.id);
            result.properties_imported++;
          } else {
            result.properties_errors.push(`${prop.title || prop.id}: ${e2?.message}`);
          }
        }
        offset += pageSize;
      }
    }

    // ── 5. Import property_images (paginated) ──
    if (importTables.includes("property_images") && propertyIdMap.size > 0) {
      const oldPropertyIds = Array.from(propertyIdMap.keys());
      
      // Process in chunks of 20 property IDs at a time
      for (let i = 0; i < oldPropertyIds.length; i += 20) {
        const chunk = oldPropertyIds.slice(i, i + 20);
        
        const { data: srcImages, error: e1 } = await source
          .from("property_images").select("*")
          .in("property_id", chunk)
          .order("display_order", { ascending: true });

        if (e1) {
          console.error("Error fetching property_images:", e1.message);
          continue;
        }

        for (const img of srcImages || []) {
          const newPropertyId = propertyIdMap.get(img.property_id);
          if (!newPropertyId) continue;

          const { error: e2 } = await dest
            .from("property_images")
            .insert({
              property_id: newPropertyId,
              url: img.url,
              is_cover: img.is_cover,
              display_order: img.display_order,
              image_type: img.image_type,
              source: img.source,
              r2_key_full: img.r2_key_full,
              r2_key_thumb: img.r2_key_thumb,
              storage_provider: img.storage_provider,
              cached_thumbnail_url: img.cached_thumbnail_url,
            });

          if (e2) {
            result.images_errors.push(`img ${img.id}: ${e2.message}`);
          } else {
            result.images_imported++;
          }
        }
      }
    }

    // ── 6. Import leads (paginated) ──
    if (importTables.includes("leads")) {
      let offset = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        let query = source.from("leads").select("*");
        if (source_organization_id) {
          query = query.eq("organization_id", source_organization_id);
        }
        const { data: srcLeads, error: e1 } = await query
          .range(offset, offset + pageSize - 1)
          .order("created_at", { ascending: true });

        if (e1) {
          console.error("Error fetching leads:", e1.message);
          break;
        }
        if (!srcLeads || srcLeads.length === 0) { hasMore = false; break; }
        if (srcLeads.length < pageSize) hasMore = false;

        for (const lead of srcLeads) {
          // Check for duplicates by name+phone or name+email
          let existingQuery = dest.from("leads").select("id")
            .eq("organization_id", target_organization_id)
            .eq("name", lead.name);
          
          if (lead.phone) {
            existingQuery = existingQuery.eq("phone", lead.phone);
          } else if (lead.email) {
            existingQuery = existingQuery.eq("email", lead.email);
          }

          const { data: existing } = await existingQuery.maybeSingle();
          if (existing) {
            leadIdMap.set(lead.id, existing.id);
            result.leads_skipped++;
            continue;
          }

          const newLead: Record<string, unknown> = {
            organization_id: target_organization_id,
            created_by: target_user_id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            stage: lead.stage || "novo",
            estimated_value: lead.estimated_value,
            source: lead.source,
            notes: lead.notes,
            is_active: lead.is_active,
            temperature: lead.temperature,
            transaction_interest: lead.transaction_interest,
            min_bedrooms: lead.min_bedrooms,
            max_bedrooms: lead.max_bedrooms,
            min_area: lead.min_area,
            max_area: lead.max_area,
            preferred_neighborhoods: lead.preferred_neighborhoods,
            preferred_cities: lead.preferred_cities,
            additional_requirements: lead.additional_requirements,
            external_source: lead.external_source || "import",
            external_id: lead.id,
            position: lead.position,
            score: lead.score,
            lead_stage_id: lead.lead_stage_id ? leadStageMap.get(lead.lead_stage_id) || null : null,
            lead_type_id: lead.lead_type_id ? leadTypeMap.get(lead.lead_type_id) || null : null,
            property_id: lead.property_id ? propertyIdMap.get(lead.property_id) || null : null,
          };

          const { data: created, error: e2 } = await dest
            .from("leads")
            .insert(newLead)
            .select("id")
            .single();

          if (created) {
            leadIdMap.set(lead.id, created.id);
            result.leads_imported++;
          } else {
            result.leads_errors.push(`${lead.name}: ${e2?.message}`);
          }
        }
        offset += pageSize;
      }
    }

    // ── 7. Import lead_interactions ──
    if (importTables.includes("lead_interactions") && leadIdMap.size > 0) {
      const oldLeadIds = Array.from(leadIdMap.keys());

      for (let i = 0; i < oldLeadIds.length; i += 20) {
        const chunk = oldLeadIds.slice(i, i + 20);

        const { data: srcInteractions, error: e1 } = await source
          .from("lead_interactions").select("*")
          .in("lead_id", chunk)
          .order("created_at", { ascending: true });

        if (e1) {
          console.error("Error fetching lead_interactions:", e1.message);
          continue;
        }

        for (const inter of srcInteractions || []) {
          const newLeadId = leadIdMap.get(inter.lead_id);
          if (!newLeadId) continue;

          const { error: e2 } = await dest
            .from("lead_interactions")
            .insert({
              lead_id: newLeadId,
              type: inter.type,
              description: inter.description,
              created_by: target_user_id,
              created_at: inter.created_at,
            });

          if (!e2) result.lead_interactions_imported++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
