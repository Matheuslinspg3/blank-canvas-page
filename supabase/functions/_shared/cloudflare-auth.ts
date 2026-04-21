const AUTH_HEADER_PREFIX_REGEX = /^authorization\s*:\s*/i;
const BEARER_PREFIX_REGEX = /^Bearer\s+/i;
const SURROUNDING_QUOTES_REGEX = /^['"]+|['"]+$/g;

export function normalizeCloudflareToken(rawToken: string | null | undefined): string {
  return (rawToken ?? "")
    .trim()
    .replace(SURROUNDING_QUOTES_REGEX, "")
    .trim()
    .replace(AUTH_HEADER_PREFIX_REGEX, "")
    .trim()
    .replace(BEARER_PREFIX_REGEX, "")
    .trim()
    .replace(SURROUNDING_QUOTES_REGEX, "")
    .trim();
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
