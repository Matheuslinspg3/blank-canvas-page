/**
 * send-push — Phase 0 Hardened
 *
 * Two auth paths:
 *  1. Internal (n8n/triggers): X-Webhook-Secret or service_role_key — org scope not enforced.
 *  2. User JWT: requires admin/sub_admin/developer role + target user must be in same org.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NotificationService } from "../_shared/notification-service.ts";
import { resolveAuthContext, requireRole, isInternalCall, createServiceClient } from "../_shared/auth-helpers.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushPayload {
  user_id: string;
  title: string;
  message?: string;
  entity_id?: string;
  entity_type?: string;
  notification_type?: string;
}

function getEntityLink(entityType?: string, entityId?: string): string {
  if (!entityType || !entityId) return "/dashboard";
  switch (entityType) {
    case "lead": return `/crm?lead=${entityId}`;
    case "property": return `/imoveis/${entityId}`;
    case "appointment": return `/agenda?appointment=${entityId}`;
    default: return "/dashboard";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Determine auth method ---
    const internal = isInternalCall(req);
    let callerUserId: string | null = null;
    let callerOrgId: string | null = null;
    let authMethod: string;

    if (internal) {
      // INTERNAL CALL: trusted (n8n, DB triggers, service_role_key)
      authMethod = "internal";
      console.log("[send-push] Internal call authorized");
    } else {
      // USER CALL: validate JWT and require role
      const { ctx, error: authError } = await resolveAuthContext(req);
      if (authError || !ctx) {
        console.warn("[send-push] Auth failed:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Require admin/sub_admin/developer role for user calls
      if (!requireRole(ctx, ["admin", "sub_admin", "developer"])) {
        console.warn(`[send-push] Forbidden: user=${ctx.userId} roles=${ctx.roles.join(",")}`);
        return new Response(JSON.stringify({ error: "Forbidden: insufficient role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      callerUserId = ctx.userId;
      callerOrgId = ctx.organizationId;
      authMethod = "user_jwt";
    }

    const body: PushPayload = await req.json();
    const { user_id, title, message, entity_id, entity_type, notification_type } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Org scope validation for user calls ---
    if (!internal && callerOrgId) {
      const supabase = createServiceClient();
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!targetProfile?.organization_id || targetProfile.organization_id !== callerOrgId) {
        const reqMeta = extractRequestMeta(req);
        await auditLog({
          event_type: "cross_org_push",
          severity: "error",
          endpoint: "send-push",
          actor_user_id: callerUserId || undefined,
          actor_org_id: callerOrgId || undefined,
          target_type: "user",
          target_id: user_id,
          decision: "deny",
          reason_code: "cross_org",
          metadata: { target_org: targetProfile?.organization_id },
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        console.warn(`[send-push] Cross-org denied: caller_org=${callerOrgId} target_user=${user_id}`);
        return new Response(JSON.stringify({ error: "Forbidden: target user not in your organization" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const APP_URL = Deno.env.get("APP_URL")?.trim() || "https://portadocorretor.com.br";
    const webUrl = entity_type && entity_id
      ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
      : `${APP_URL}/dashboard`;

    const service = new NotificationService(req);
    const result = await service.sendToUser(user_id, title, message || title, {
      entity_id: entity_id || "",
      entity_type: entity_type || "",
      notification_type: notification_type || "",
      web_url: webUrl,
    });

    console.log(JSON.stringify({
      event: "send-push",
      auth_method: authMethod,
      caller_id: callerUserId,
      target_user_id: user_id,
      sent: result.recipientsCount ?? 0,
      ok: result.ok,
    }));

    if (result.ok && result.recipientsCount === 0) {
      console.log(JSON.stringify({
        event: "send-push-no-recipients",
        user_id,
        reason: result.reason ?? null,
        resolvedDeviceCount: result.resolvedDeviceCount ?? null,
        attemptedIds: result.attemptedIds ?? null,
        invalidIdsRemoved: result.invalidIdsRemoved ?? null,
        providerErrors: result.raw?.errors ?? null,
      }));
    }

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        sent: result.recipientsCount,
        id: result.notificationId,
        user_id,
        provider: "onesignal",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-push] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
