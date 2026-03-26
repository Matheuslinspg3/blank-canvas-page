/**
 * Shared response helpers for Edge Functions.
 * Import: import { json, errorResponse } from "../_shared/response.ts";
 */
import { corsHeaders } from "./cors.ts";

/** Return a JSON success response. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Return a JSON error response. */
export function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error: message, ...extra }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
