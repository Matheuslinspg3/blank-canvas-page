/**
 * Shared auth helpers for Edge Functions — Phase 0 Hardening.
 *
 * Provides:
 *  - resolveAuthContext(req)  — validate JWT + resolve user/org/roles
 *  - requireRole(ctx, roles)  — assert caller has at least one of the roles
 *  - isInternalCall(req)      — verify X-Webhook-Secret header
 *  - isAdminAllowlisted(sb, email) — check admin_allowlist table
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";

export interface AuthContext {
  userId: string;
  email: string | null;
  organizationId: string | null;
  roles: string[]; // e.g. ["admin", "developer"]
}

/**
 * Validates the JWT from the Authorization header and resolves user context.
 * Returns { ctx, error }. If error is set, ctx is null.
 */
export async function resolveAuthContext(
  req: Request,
): Promise<{ ctx: AuthContext | null; error: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ctx: null, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");

  // Validate JWT via getClaims (verifies signature)
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return { ctx: null, error: claimsError?.message ?? "Invalid token" };
  }

  const userId = claimsData.claims.sub as string;
  const email = (claimsData.claims.email as string) || null;

  // Service client for DB lookups
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve organization_id and roles in parallel
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId),
  ]);

  const organizationId = profileRes.data?.organization_id ?? null;
  const roles = (rolesRes.data || []).map((r: { role: string }) => r.role);

  return {
    ctx: { userId, email, organizationId, roles },
    error: null,
  };
}

/**
 * Checks if the caller has at least one of the required roles.
 */
export function requireRole(ctx: AuthContext, requiredRoles: string[]): boolean {
  return ctx.roles.some((r) => requiredRoles.includes(r));
}

/**
 * Checks if the request is an internal call authenticated via X-Webhook-Secret.
 * Also accepts service_role_key in the Authorization header as an internal call.
 *
 * ⚠️  PHASE 0 TRANSITIONAL SOLUTION — DO NOT treat as final security standard.
 *
 * This helper uses a shared secret (INTERNAL_WEBHOOK_SECRET) or service_role_key
 * comparison for internal service-to-service authentication. It is sufficient as
 * a P0 hotfix but lacks:
 *   - Request signing (HMAC) to prevent replay attacks
 *   - Per-service identity (all internal callers share the same secret)
 *   - Token expiration / rotation
 *
 * PHASE 1 TODO: Replace with signed M2M authentication (HMAC or short-lived
 * service JWTs) that provides per-caller identity, replay protection, and
 * automatic key rotation.
 */
export function isInternalCall(req: Request): boolean {
  // Check X-Webhook-Secret header
  const webhookSecret = req.headers.get("X-Webhook-Secret");
  if (webhookSecret && INTERNAL_WEBHOOK_SECRET && webhookSecret === INTERNAL_WEBHOOK_SECRET) {
    return true;
  }

  // Check if Authorization is service_role_key
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the email is in the admin_allowlist table.
 */
export async function isAdminAllowlisted(email: string): Promise<boolean> {
  if (!email) return false;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("admin_allowlist")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

/**
 * Create a service-role Supabase client (convenience re-export).
 */
export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
