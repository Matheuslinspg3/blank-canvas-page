/**
 * Platform-wide constants.
 * The PLATFORM_DOMAIN is the base domain used to generate default
 * white-label site URLs for each organization: {slug}.portadocorretor.com.br
 */
export const PLATFORM_DOMAIN = "portadocorretor.com.br";

/** Build the default subdomain URL for an org */
export function buildOrgSubdomainUrl(slug: string): string {
  return `https://${slug}.${PLATFORM_DOMAIN}`;
}

/**
 * Checks if a hostname is a platform subdomain (e.g. portocaicara.portadocorretor.com.br)
 * Returns the slug if it is, null otherwise.
 */
export function extractPlatformSlug(hostname: string): string | null {
  const suffix = `.${PLATFORM_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  // slug must be non-empty and not contain dots (no nested subdomains)
  if (!slug || slug.includes(".")) return null;
  return slug;
}
