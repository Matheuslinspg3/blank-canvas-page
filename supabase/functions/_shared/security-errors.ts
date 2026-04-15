/**
 * Standardized security error responses — Phase 1 Security Core.
 *
 * Provides consistent HTTP error responses across all Edge Functions.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function unauthorizedResponse(detail?: string): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized", detail: detail || "Authentication required" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function forbiddenResponse(detail?: string): Response {
  return new Response(
    JSON.stringify({ error: "Forbidden", detail: detail || "Insufficient permissions" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function rateLimitedResponse(detail?: string, retryAfter = 3600): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", detail: detail || "Too many requests" }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export function badRequestResponse(detail?: string): Response {
  return new Response(
    JSON.stringify({ error: "Bad Request", detail: detail || "Invalid input" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export { corsHeaders };
