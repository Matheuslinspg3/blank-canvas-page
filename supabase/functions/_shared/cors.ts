/**
 * Shared CORS headers for all Edge Functions.
 * Import: import { corsHeaders, handleCors } from "../_shared/cors.ts";
 */

const ALLOWED_ORIGINS = [
  "https://portocaicaraimoveis.lovable.app",
  "https://id-preview--d95e3b13-a4a6-40e4-8239-2a6ce6cdfb60.lovable.app",
];

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Returns a 204 Response for OPTIONS preflight, or null if not a preflight.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
