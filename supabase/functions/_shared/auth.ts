/**
 * Shared auth utilities for Edge Functions.
 * Import: import { getAuthenticatedUser, createServiceClient, createUserClient } from "../_shared/auth.ts";
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Create a service-role client (bypasses RLS). */
export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/** Create a client scoped to the requesting user's JWT. */
export function createUserClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Extracts and verifies the authenticated user from the request.
 * Returns { user, error }.
 */
export async function getAuthenticatedUser(
  req: Request,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { user: null, error: "Missing Authorization header" };
  }

  const client = createUserClient(authHeader);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return { user: null, error: error?.message ?? "Invalid token" };
  }

  return { user: { id: user.id, email: user.email }, error: null };
}
