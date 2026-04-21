const BEARER_PREFIX_REGEX = /^Bearer\s+/i;

export function normalizeCloudflareToken(rawToken: string | null | undefined): string {
  return (rawToken ?? "").trim().replace(BEARER_PREFIX_REGEX, "").trim();
}

export function getCloudflareAuthHeaders(rawToken: string | null | undefined, contentType?: string): HeadersInit {
  const token = normalizeCloudflareToken(rawToken);

  if (!token) {
    throw new Error("Cloudflare token is missing or empty");
  }

  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}
