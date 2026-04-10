import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

function parseBody(raw: string): Record<string, unknown> {
  let cleaned = raw.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const s = cleaned.search(/\{/);
  const e = cleaned.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON object");
  cleaned = cleaned.substring(s, e + 1);
  try { return JSON.parse(cleaned); } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const requestSecret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (!raw || !raw.trim()) {
        return new Response(JSON.stringify({ error: "Empty request body" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = parseBody(raw);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Invalid JSON", detail: err.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, instance_name } = body as any;

    // Support both nested `filters` object AND flat params
    const filters = (body.filters as Record<string, unknown>) || {};
    const property_type = filters.property_type || body.property_type;
    const neighborhood = filters.neighborhood || body.neighborhood;
    const max_price = filters.max_price || body.max_price;
    const city = filters.city || body.city;
    const transaction_type = filters.transaction_type || body.transaction_type;
    const bedrooms = filters.bedrooms || body.bedrooms;

    if (!organization_id && !instance_name) {
      return new Response(JSON.stringify({ error: "organization_id ou instance_name obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

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
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    if (bedrooms) query = query.gte("bedrooms", Number(bedrooms));
    if (max_price) {
      query = query.or(`sale_price.lte.${max_price},rent_price.lte.${max_price}`);
    }
    if (neighborhood) {
      query = query.ilike("address_neighborhood", `%${neighborhood}%`);
    }
    if (city) {
      query = query.ilike("address_city", `%${city}%`);
    }
    if (transaction_type) {
      query = query.eq("transaction_type", transaction_type);
    }
    if (property_type) {
      const searchName = String(property_type).toLowerCase().trim();
      const matchedId = Object.entries(propertyTypeMap).find(
        ([, name]) => name.toLowerCase().trim() === searchName
      )?.[0];
      if (matchedId) {
        query = query.eq("property_type_id", matchedId);
      } else {
        return new Response(JSON.stringify({ properties: [], total: 0, property_types: propertyTypeMap, message: `Tipo "${property_type}" não encontrado` }), {
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

    // Fetch cover images for all properties
    const propIds = filtered.map((p) => p.id);
    const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim().replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

    let coverMap: Record<string, string> = {};
    if (propIds.length > 0) {
      const { data: coverImgs } = await sb
        .from("property_images")
        .select("property_id, url, r2_key_full, storage_provider, is_cover, display_order, cached_thumbnail_url")
        .in("property_id", propIds)
        .order("is_cover", { ascending: false })
        .order("display_order", { ascending: true });

      // Pick one cover per property
      const seen = new Set<string>();
      for (const img of (coverImgs || [])) {
        if (seen.has(img.property_id)) continue;
        seen.add(img.property_id);
        if (img.storage_provider === "r2" && img.r2_key_full && R2_PUBLIC_URL) {
          coverMap[img.property_id] = `${R2_PUBLIC_URL}/${img.r2_key_full}`;
        } else if (img.url?.includes("res.cloudinary.com")) {
          coverMap[img.property_id] = `${SUPABASE_URL}/functions/v1/cloudinary-image-proxy?url=${encodeURIComponent(img.url)}`;
        } else if (img.url) {
          coverMap[img.property_id] = img.url;
        }
      }
    }

    const result = filtered.map((p) => ({
      ...p,
      property_type_name: propertyTypeMap[p.property_type_id] ?? null,
      is_highlighted: highlightIds.has(p.id),
      cover_image_url: coverMap[p.id] || null,
    }));

    return new Response(JSON.stringify({ properties: result, total: result.length, property_types: propertyTypeMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-agent-properties error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
