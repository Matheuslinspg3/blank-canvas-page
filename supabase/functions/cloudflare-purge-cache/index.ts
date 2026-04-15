/**
 * cloudflare-purge-cache — Phase 1 Hardened
 *
 * Security: Only developer role OR admin_allowlist emails can purge.
 * Rate limit: 3 req/hour per user.
 * Audit: Every execution is logged to security_audit_events.
 */
import { requireAuth, requireRole, isAdminAllowlisted, createServiceClient, auditLog, extractRequestMeta } from "../_shared/security-core.ts";
import { checkRateLimit } from "../_shared/security-rate-limit.ts";
import { corsHeaders } from "../_shared/security-errors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqMeta = extractRequestMeta(req);

  try {
    // --- Auth ---
    const authResult = await requireAuth(req);
    if (authResult.error) return authResult.error;
    const ctx = authResult.ctx;

    // --- Authz: only developer role OR admin_allowlist ---
    const isDeveloper = requireRole(ctx, ["developer"]);
    const isAllowlisted = ctx.email ? await isAdminAllowlisted(ctx.email) : false;

    if (!isDeveloper && !isAllowlisted) {
      await auditLog({
        event_type: "cache_purge",
        severity: "warn",
        endpoint: "cloudflare-purge-cache",
        actor_user_id: ctx.userId,
        actor_org_id: ctx.organizationId || undefined,
        decision: "deny",
        reason_code: "insufficient_role",
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });
      return new Response(JSON.stringify({ error: "Forbidden: requires developer role or admin allowlist" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Rate limit ---
    const { allowed } = await checkRateLimit(`cache-purge:${ctx.userId}`, 3, 3600);
    if (!allowed) {
      await auditLog({
        event_type: "rate_limit",
        severity: "warn",
        endpoint: "cloudflare-purge-cache",
        actor_user_id: ctx.userId,
        actor_org_id: ctx.organizationId || undefined,
        decision: "deny",
        reason_code: "rate_limit_exceeded",
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });
      return new Response(JSON.stringify({ error: "Rate limit exceeded (3/hour)" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // --- Audit log ---
    await auditLog({
      event_type: "cache_purge",
      severity: "info",
      endpoint: "cloudflare-purge-cache",
      actor_user_id: ctx.userId,
      actor_org_id: ctx.organizationId || undefined,
      target_type: "cloudflare_zone",
      target_id: zoneId,
      decision: cfData.success ? "allow" : "deny",
      reason_code: cfData.success ? "purge_success" : "purge_failed",
      metadata: {
        auth_method: isDeveloper ? "developer_role" : "admin_allowlist",
        cf_success: cfData.success,
      },
      ip: reqMeta.ip,
      user_agent: reqMeta.userAgent,
    });

    if (!cfData.success) {
      return new Response(
        JSON.stringify({ error: "Cloudflare purge failed", details: cfData.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[cloudflare-purge-cache] Success by user=${ctx.userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Cache purged successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cloudflare-purge-cache] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
