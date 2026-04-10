import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

/**
 * Returns resolved public image URLs for one or more properties.
 * 
 * POST body:
 *  - property_ids: string[]           (required)
 *  - organization_id: string          (required)
 *  - mode: "cover" | "all"            (default: "cover")
 *  - limit_per_property: number       (default: 20, max 30)
 */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const secret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { property_ids, organization_id, mode = "cover", limit_per_property = 20 } = body;

    if (!organization_id || !Array.isArray(property_ids) || property_ids.length === 0) {
      return new Response(JSON.stringify({ error: "property_ids (array) e organization_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limitCapped = Math.min(Number(limit_per_property) || 20, 30);
    const sb = createServiceClient();
    const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim().replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

    // Fetch images for all requested properties
    let query = sb
      .from("property_images")
      .select("id, property_id, url, r2_key_full, r2_key_thumb, storage_provider, is_cover, display_order, cached_thumbnail_url")
      .in("property_id", property_ids.slice(0, 20))
      .eq("organization_id", organization_id)
      .order("is_cover", { ascending: false })
      .order("display_order", { ascending: true });

    if (mode === "cover") {
      // For cover mode, get only the cover image of each property
      query = query.eq("is_cover", true);
    }

    const { data: images, error } = await query.limit(property_ids.length * limitCapped);
    if (error) throw error;

    // Resolve URLs to public accessible URLs
    const resolveUrl = (img: any): string => {
      if (img.storage_provider === "r2" && img.r2_key_full && R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${img.r2_key_full}`;
      }
      if (img.url && img.url.includes("res.cloudinary.com")) {
        return `${SUPABASE_URL}/functions/v1/cloudinary-image-proxy?url=${encodeURIComponent(img.url)}`;
      }
      return img.url || "";
    };

    const resolveThumbUrl = (img: any): string => {
      if (img.storage_provider === "r2" && img.r2_key_thumb && R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${img.r2_key_thumb}`;
      }
      if (img.cached_thumbnail_url) {
        if (img.cached_thumbnail_url.includes("res.cloudinary.com")) {
          return `${SUPABASE_URL}/functions/v1/cloudinary-image-proxy?url=${encodeURIComponent(img.cached_thumbnail_url)}`;
        }
        return img.cached_thumbnail_url;
      }
      return resolveUrl(img);
    };

    // Group by property_id
    const grouped: Record<string, any[]> = {};
    for (const img of (images || [])) {
      const pid = img.property_id;
      if (!grouped[pid]) grouped[pid] = [];
      if (grouped[pid].length >= limitCapped) continue;
      grouped[pid].push({
        id: img.id,
        url: resolveUrl(img),
        thumb_url: resolveThumbUrl(img),
        is_cover: img.is_cover,
        display_order: img.display_order,
      });
    }

    // For cover mode, if no is_cover image found, fetch first image as fallback
    if (mode === "cover") {
      const missingCover = property_ids.filter((pid: string) => !grouped[pid] || grouped[pid].length === 0);
      if (missingCover.length > 0) {
        const { data: fallbackImgs } = await sb
          .from("property_images")
          .select("id, property_id, url, r2_key_full, r2_key_thumb, storage_provider, is_cover, display_order, cached_thumbnail_url")
          .in("property_id", missingCover)
          .eq("organization_id", organization_id)
          .order("display_order", { ascending: true })
          .limit(missingCover.length);

        for (const img of (fallbackImgs || [])) {
          const pid = img.property_id;
          if (!grouped[pid]) {
            grouped[pid] = [{
              id: img.id,
              url: resolveUrl(img),
              thumb_url: resolveThumbUrl(img),
              is_cover: img.is_cover,
              display_order: img.display_order,
            }];
          }
        }
      }
    }

    return new Response(JSON.stringify({ images: grouped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("whatsapp-property-images error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
