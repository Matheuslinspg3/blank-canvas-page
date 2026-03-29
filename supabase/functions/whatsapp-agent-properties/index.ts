import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const requestSecret = req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organization_id, instance_name, filters } = body;

    if (!organization_id && !instance_name) {
      return new Response(JSON.stringify({ error: "organization_id ou instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // Single query to resolve config
    let config: any = null;
    if (organization_id) {
      const { data } = await sb
        .from("whatsapp_agent_config")
        .select("organization_id, is_property_db_enabled")
        .eq("organization_id", organization_id)
        .maybeSingle();
      config = data;
    } else {
      const { data } = await sb
        .from("whatsapp_agent_config")
        .select("organization_id, is_property_db_enabled")
        .eq("instance_name", instance_name)
        .maybeSingle();
      config = data;
    }

    if (!config) {
      return new Response(JSON.stringify({ error: "Configuração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = config.organization_id;

    if (!config.is_property_db_enabled) {
      return new Response(JSON.stringify({ properties: [], message: "Banco de imóveis desabilitado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch property types
    const { data: propertyTypes = [] } = await sb
      .from("property_types")
      .select("id, name")
      .or(`organization_id.eq.${orgId},is_default.eq.true`);

    const propertyTypeMap: Record<string, string> = {};
    (propertyTypes as any[]).forEach((pt: any) => {
      propertyTypeMap[pt.id] = pt.name;
    });

    // Fetch highlight rules
    const { data: rules = [] } = await sb
      .from("whatsapp_property_rules")
      .select("property_id, rule_type")
      .eq("organization_id", orgId)
      .eq("rule_type", "highlight");

    const highlightIds = new Set(rules.map((r: any) => r.property_id));

    let query = sb
      .from("properties")
      .select("id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id")
      .eq("organization_id", orgId)
      .eq("status", "disponivel")
      .eq("ai_blacklist", false);

    if (filters?.bedrooms) query = query.gte("bedrooms", filters.bedrooms);
    if (filters?.max_price) {
      query = query.or(`sale_price.lte.${filters.max_price},rent_price.lte.${filters.max_price}`);
    }
    if (filters?.neighborhood) {
      query = query.ilike("address_neighborhood", `%${filters.neighborhood}%`);
    }
    if (filters?.city) {
      query = query.ilike("address_city", `%${filters.city}%`);
    }
    if (filters?.transaction_type) {
      query = query.eq("transaction_type", filters.transaction_type);
    }
    // Resolve property_type by name (text) → UUID
    if (filters?.property_type) {
      const searchName = filters.property_type.toLowerCase().trim();
      const matchedId = Object.entries(propertyTypeMap).find(
        ([, name]) => name.toLowerCase().trim() === searchName
      )?.[0];
      if (matchedId) {
        query = query.eq("property_type_id", matchedId);
      } else {
        // No match found — return empty to avoid wrong results
        return new Response(JSON.stringify({ properties: [], total: 0, property_types: propertyTypeMap, message: `Tipo "${filters.property_type}" não encontrado` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: properties = [], error } = await query.limit(50);
    if (error) throw error;

    const filtered = (properties as any[]);
    filtered.sort((a, b) => {
      const aH = highlightIds.has(a.id) ? 0 : 1;
      const bH = highlightIds.has(b.id) ? 0 : 1;
      return aH - bH;
    });

    const result = filtered.map((p) => ({
      ...p,
      property_type_name: propertyTypeMap[p.property_type_id] ?? null,
      is_highlighted: highlightIds.has(p.id),
    }));

    return new Response(JSON.stringify({ properties: result, total: result.length, property_types: propertyTypeMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-agent-properties error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
