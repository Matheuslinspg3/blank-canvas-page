import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_REQUESTS_PER_HOUR = 20;

/**
 * Check if a user has exceeded the AI rate limit (20 requests/hour).
 * Returns null if OK, or a 429 Response if rate limited.
 */
export async function checkAiRateLimit(
  userId: string,
  functionName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (error) {
    console.error(`[ai-rate-limit] Error checking rate limit for ${functionName}:`, error.message);
    // Don't block on rate limit check errors
    return null;
  }

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    console.warn(`[ai-rate-limit] User ${userId} exceeded ${MAX_REQUESTS_PER_HOUR} req/h on ${functionName} (count: ${count})`);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `Limite de ${MAX_REQUESTS_PER_HOUR} requisições por hora excedido. Tente novamente mais tarde.`,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return null;
}
