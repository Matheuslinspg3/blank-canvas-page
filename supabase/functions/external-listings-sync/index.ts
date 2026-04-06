import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

const N8N_EXTERNAL_LISTINGS_WEBHOOK = Deno.env.get("N8N_EXTERNAL_LISTINGS_WEBHOOK") || "";
const CACHE_TTL_HOURS = 6;

interface ExternalFilters {
  city?: string;
  neighborhood?: string;
  transaction_type?: string;
  bedrooms?: number;
  source?: string;
}

function buildSearchHash(filters: ExternalFilters): string {
  const normalized = JSON.stringify({
    city: (filters.city || "").toLowerCase().trim(),
    neighborhood: (filters.neighborhood || "").toLowerCase().trim(),
    transaction_type: filters.transaction_type || "",
    bedrooms: filters.bedrooms || 0,
    source: filters.source || "all",
  });
  return normalized;
}

async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    // Auth: accept both JWT and webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const isWebhook = webhookSecret === Deno.env.get("WHATSAPP_AGENT_SECRET");

    if (!isWebhook) {
      const { user, error } = await getAuthenticatedUser(req);
      if (error || !user) {
        return errorResponse("Unauthorized", 401);
      }
    }

    const supabase = createServiceClient();

    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action || "search";

      // ACTION: n8n callback — insert listings and update cache
      if (action === "insert_results") {
        const { search_hash, listings } = body;
        if (!search_hash || !Array.isArray(listings)) {
          return errorResponse("search_hash and listings[] required");
        }

        const listingIds: string[] = [];

        for (const l of listings) {
          const { data, error } = await supabase
            .from("external_listings")
            .upsert(
              {
                source: l.source,
                source_id: l.source_id || l.source_url,
                source_url: l.source_url,
                title: l.title,
                description: l.description,
                address_city: l.address_city,
                address_neighborhood: l.address_neighborhood,
                address_state: l.address_state,
                transaction_type: l.transaction_type,
                sale_price: l.sale_price,
                rent_price: l.rent_price,
                bedrooms: l.bedrooms,
                bathrooms: l.bathrooms,
                parking_spots: l.parking_spots,
                area_total: l.area_total,
                images: l.images || [],
                contact_phone: l.contact_phone,
                contact_name: l.contact_name,
                updated_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600000).toISOString(),
              },
              { onConflict: "source,source_id" },
            )
            .select("id")
            .single();

          if (data) listingIds.push(data.id);
        }

        // Update search cache
        await supabase
          .from("external_search_cache")
          .upsert(
            {
              search_hash,
              filters_json: body.filters || {},
              listing_ids: listingIds,
              fetched_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600000).toISOString(),
            },
            { onConflict: "search_hash" },
          );

        return json({ success: true, count: listingIds.length });
      }

      // ACTION: search — cache-first, then trigger n8n
      const filters: ExternalFilters = {
        city: body.city,
        neighborhood: body.neighborhood,
        transaction_type: body.transaction_type,
        bedrooms: body.bedrooms,
        source: body.source,
      };

      const hashInput = buildSearchHash(filters);
      const searchHash = await sha256Hash(hashInput);

      // Query existing listings that match filters
      let query = supabase
        .from("external_listings")
        .select("*")
        .gt("expires_at", new Date().toISOString());

      if (filters.city) query = query.ilike("address_city", `%${filters.city}%`);
      if (filters.neighborhood) query = query.ilike("address_neighborhood", `%${filters.neighborhood}%`);
      if (filters.transaction_type) query = query.eq("transaction_type", filters.transaction_type);
      if (filters.bedrooms) query = query.gte("bedrooms", filters.bedrooms);
      if (filters.source && filters.source !== "all") query = query.eq("source", filters.source);

      const { data: existingListings } = await query.limit(50);

      // ALWAYS trigger n8n webhook to refresh data (fire and forget)
      let n8nTriggered = false;
      if (N8N_EXTERNAL_LISTINGS_WEBHOOK) {
        const edgeFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/external-listings-sync`;
        
        fetch(N8N_EXTERNAL_LISTINGS_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            search_hash: searchHash,
            filters,
            callback_url: edgeFunctionUrl,
            callback_secret: Deno.env.get("WHATSAPP_AGENT_SECRET"),
          }),
        }).catch((err) => console.error("[external-listings-sync] n8n trigger failed:", err));
        n8nTriggered = true;
        console.log("[external-listings-sync] n8n triggered for hash:", searchHash, "filters:", JSON.stringify(filters));
      } else {
        console.warn("[external-listings-sync] N8N_EXTERNAL_LISTINGS_WEBHOOK not configured");
      }

      return json({
        source: "live",
        listings: existingListings || [],
        search_hash: searchHash,
        n8n_triggered: n8nTriggered,
      });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err: unknown) {
    console.error("[external-listings-sync] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(msg, 500);
  }
});
