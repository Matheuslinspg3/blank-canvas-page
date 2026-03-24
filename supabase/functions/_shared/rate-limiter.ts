const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")!;
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!;

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redisKey = `ratelimit:${key}`;

  try {
    const incrResponse = await fetch(
      `${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(redisKey)}`,
      { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } },
    );
    const { result: count } = await incrResponse.json();

    if (count === 1) {
      await fetch(
        `${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`,
        { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } },
      );
    }

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetIn: windowSeconds,
    };
  } catch (err) {
    console.error("[rate-limiter] Upstash Redis error:", err);
    // Fail-open: don't block users if Redis is down
    return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
  }
}

/**
 * Helper that checks rate limit and returns a 429 Response if exceeded, or null if allowed.
 * Drop-in replacement for checkAiRateLimit.
 */
export async function checkAiRateLimitRedis(
  userId: string,
  functionName: string,
  corsHeaders: Record<string, string>,
  maxRequests = 30,
  windowSeconds = 3600,
): Promise<Response | null> {
  const { allowed, remaining } = await checkRateLimit(
    `ai:${userId}`,
    maxRequests,
    windowSeconds,
  );

  if (!allowed) {
    console.warn(
      `[rate-limiter] User ${userId} exceeded ${maxRequests} req/${windowSeconds}s on ${functionName}`,
    );
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `Limite de ${maxRequests} requisições por hora excedido. Tente novamente mais tarde.`,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(windowSeconds),
        },
      },
    );
  }

  return null;
}
