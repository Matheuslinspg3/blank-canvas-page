/**
 * Security Core — Phase 1 Unified Security Facade.
 *
 * Provides composable security primitives for all Edge Functions:
 *  - requireAuth(req)         — validate JWT, return AuthContext or error Response
 *  - requireRole(ctx, roles)  — assert caller has at least one role
 *  - requireOrgScope(ctx, id) — verify org membership
 *  - requireOwnership(ctx, ownerId, elevatedRoles?) — verify resource ownership
 *  - auditLog(event)          — insert into security_audit_events
 *
 * Re-exports from auth-helpers.ts for backward compatibility.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveAuthContext,
  requireRole as _requireRole,
  isInternalCall,
  isAdminAllowlisted,
  createServiceClient,
  type AuthContext,
} from "./auth-helpers.ts";
import { unauthorizedResponse, forbiddenResponse } from "./security-errors.ts";

// Re-exports for convenience
export {
  resolveAuthContext,
  isInternalCall,
  isAdminAllowlisted,
  createServiceClient,
  type AuthContext,
} from "./auth-helpers.ts";
export { requireWebhookSignature } from "./security-signature.ts";
export {
  unauthorizedResponse,
  forbiddenResponse,
  rateLimitedResponse,
  badRequestResponse,
  corsHeaders,
} from "./security-errors.ts";
export { checkRateLimit, checkAiRateLimitRedis } from "./security-rate-limit.ts";

/**
 * Authenticates the request via JWT. Returns AuthContext or an error Response.
 */
export async function requireAuth(
  req: Request,
): Promise<{ ctx: AuthContext; error?: never } | { ctx?: never; error: Response }> {
  const { ctx, error } = await resolveAuthContext(req);
  if (error || !ctx) {
    return { error: unauthorizedResponse(error || "Authentication failed") };
  }
  return { ctx };
}

/**
 * Checks if the caller has at least one of the required roles.
 */
export function requireRole(ctx: AuthContext, roles: string[]): boolean {
  return _requireRole(ctx, roles);
}

/**
 * Verifies the caller belongs to the specified organization.
 */
export function requireOrgScope(ctx: AuthContext, targetOrgId: string | null): boolean {
  if (!ctx.organizationId || !targetOrgId) return false;
  return ctx.organizationId === targetOrgId;
}

/**
 * Verifies resource ownership. Caller must own the resource OR have an elevated role.
 */
export function requireOwnership(
  ctx: AuthContext,
  resourceOwnerId: string,
  elevatedRoles: string[] = ["developer", "admin", "sub_admin"],
): boolean {
  if (ctx.userId === resourceOwnerId) return true;
  return requireRole(ctx, elevatedRoles);
}

// ─── Audit Logging ───────────────────────────────────────────

export interface SecurityAuditEvent {
  event_type: string;
  severity?: "info" | "warn" | "error" | "critical";
  endpoint?: string;
  actor_type?: "user" | "system" | "webhook";
  actor_user_id?: string;
  actor_org_id?: string;
  target_type?: string;
  target_id?: string;
  decision: "allow" | "deny";
  reason_code?: string;
  request_id?: string;
  ip?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts an audit event into security_audit_events.
 * Fire-and-forget by default; errors are logged but not thrown.
 *
 * Hash chain: each event stores sha256(prev_hash + event_data) for tamper evidence.
 */
export async function auditLog(event: SecurityAuditEvent): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Get last hash for chain
    const { data: lastEvent } = await supabase
      .from("security_audit_events")
      .select("event_hash")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevHash = lastEvent?.event_hash || "genesis";

    // Compute event hash
    const eventData = JSON.stringify({
      ...event,
      prev_hash: prevHash,
      timestamp: new Date().toISOString(),
    });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(eventData));
    const eventHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await supabase.from("security_audit_events").insert({
      event_type: event.event_type,
      severity: event.severity || "info",
      endpoint: event.endpoint,
      actor_type: event.actor_type || "user",
      actor_user_id: event.actor_user_id,
      actor_org_id: event.actor_org_id,
      target_type: event.target_type,
      target_id: event.target_id,
      decision: event.decision,
      reason_code: event.reason_code,
      request_id: event.request_id,
      ip: event.ip,
      user_agent: event.user_agent,
      metadata: event.metadata || {},
      prev_hash: prevHash,
      event_hash: eventHash,
    });
  } catch (err) {
    console.error("[security-core] auditLog error:", err);
  }
}

/**
 * Helper to extract IP and User-Agent from request for audit.
 */
export function extractRequestMeta(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  };
}
