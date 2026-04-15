/**
 * cloudflare-purge-cache — Phase 0 Hardened
 *
 * Security: Only developer role OR admin_allowlist emails can purge.
 * Rate limit: 3 req/hour per user.
 * Audit: Every execution is logged to audit_events.
 */
import { resolveAuthContext, requireRole, isAdminAllowlisted, createServiceClient } from "../_shared/auth-helpers.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: resolve user context ---
    const { ctx, error: authError } = await resolveAuthContext(req);
    if (authError || !ctx) {
      console.warn("[cloudflare-purge-cache] Auth failed:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authz: only developer role OR admin_allowlist ---
    const isDeveloper = requireRole(ctx, ["developer"]);
    const isAllowlisted = ctx.email ? await isAdminAllowlisted(ctx.email) : false;

    if (!isDeveloper && !isAllowlisted) {
      console.warn(`[cloudflare-purge-cache] Access denied for user=${ctx.userId} roles=${ctx.roles.join(",")}`);
      return new Response(JSON.stringify({ error: "Forbidden: requires developer role or admin allowlist" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Rate limit: 3 req/hour per user ---
    const { allowed } = await checkRateLimit(`cache-purge:${ctx.userId}`, 3, 3600);
    if (!allowed) {
      console.warn(`[cloudflare-purge-cache] Rate limited user=${ctx.userId}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded (3/hour)" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Execute Cloudflare purge ---
    const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!zoneId || !apiToken) {
      return new Response(
        JSON.stringify({ error: "Cloudflare credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      },
    );

    const cfData = await cfResponse.json();

    // --- Audit log (fire and forget) ---
    const supabase = createServiceClient();
    supabase.from("audit_events").insert({
      action: "cache_purge",
      action_category: "infrastructure",
      entity_type: "cloudflare_cache",
      entity_id: zoneId,
      user_id: ctx.userId,
      organization_id: ctx.organizationId,
      description: `Cache purge ${cfData.success ? "succeeded" : "failed"}`,
      metadata: {
        cf_success: cfData.success,
        auth_method: isDeveloper ? "developer_role" : "admin_allowlist",
      },
      risk_level: "medium",
      source: "edge_function",
    }).then(() => {});

    if (!cfData.success) {
      return new Response(
        JSON.stringify({ error: "Cloudflare purge failed", details: cfData.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[cloudflare-purge-cache] Success by user=${ctx.userId} method=${isDeveloper ? "developer_role" : "admin_allowlist"}`);

    return new Response(
      JSON.stringify({ success: true, message: "Cache purged successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cloudflare-purge-cache] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
