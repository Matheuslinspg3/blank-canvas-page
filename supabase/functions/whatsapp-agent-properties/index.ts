import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Validate X-Webhook-Secret header
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

    // Resolve org ID from instance_name if needed
    let resolvedOrgId = organization_id;
    if (!resolvedOrgId && instance_name) {
      const { data: inst } = await sb
        .from("whatsapp_instances")
        .select("organization_id")
        .eq("instance_name", instance_name)
        .maybeSingle();
      if (!inst) {
        return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedOrgId = inst.organization_id;
    }

    // Validate organization exists
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("id", resolvedOrgId)
      .maybeSingle();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organization_id_resolved = resolvedOrgId;

    // Check if property DB is enabled
    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("is_property_db_enabled")
      .eq("organization_id", organization_id_resolved)
      .maybeSingle();

    if (!config?.is_property_db_enabled) {
      return new Response(JSON.stringify({ properties: [], message: "Banco de imóveis desabilitado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch highlight rules (blacklist is now on properties table)
    const { data: rules = [] } = await sb
      .from("whatsapp_property_rules")
      .select("property_id, rule_type")
      .eq("organization_id", organization_id_resolved)
      .eq("rule_type", "highlight");

    const highlightIds = new Set(rules.map((r: any) => r.property_id));

    // Build query — ai_blacklist = false filters out blocked properties
    let query = sb
      .from("properties")
      .select("id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id")
      .eq("organization_id", organization_id_resolved)
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

    const { data: properties = [], error } = await query.limit(50);
    if (error) throw error;

    // Filter by whitelist/blacklist
    let filtered = (properties as any[]).filter((p) => !blacklistIds.has(p.id));
    if (whitelistIds.size > 0) {
      filtered = filtered.filter((p) => whitelistIds.has(p.id));
    }

    // Sort: highlighted first
    filtered.sort((a, b) => {
      const aH = highlightIds.has(a.id) ? 0 : 1;
      const bH = highlightIds.has(b.id) ? 0 : 1;
      return aH - bH;
    });

    const result = filtered.map((p) => ({
      ...p,
      is_highlighted: highlightIds.has(p.id),
    }));

    return new Response(JSON.stringify({ properties: result, total: result.length }), {
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
