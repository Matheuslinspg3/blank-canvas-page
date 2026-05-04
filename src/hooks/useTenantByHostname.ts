import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractPlatformSlug, PLATFORM_DOMAIN } from "@/config/platform";
import { withTimeout } from "@/lib/withTimeout";
import * as Sentry from "@sentry/react";

const KNOWN_APP_HOSTS = [
  "localhost",
  "lovable.app",
  "lovable.dev",
  "lovableproject.com",
  "webcontainer.io",
];

function isAppHost(hostname: string): boolean {
  return KNOWN_APP_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

// ---------- sessionStorage cache (avoids spinner on repeat visits) ----------
const CACHE_TTL_MS = 30 * 60_000; // 30 min
const CACHE_PREFIX = "tenant-cache:";

interface CachedTenant {
  organizationId: string | null;
  ts: number;
}

function readCache(hostname: string): CachedTenant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + hostname);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTenant;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(hostname: string, organizationId: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CACHE_PREFIX + hostname,
      JSON.stringify({ organizationId, ts: Date.now() } satisfies CachedTenant),
    );
  } catch { /* quota / private mode — ignore */ }
}

const RPC_TIMEOUT_MS = 8_000;

/**
 * Resolves the current hostname to an organization_id.
 *
 * 1. Platform subdomains ({slug}.portadocorretor.com.br) → lookup by slug
 * 2. Custom domains (www.clientsite.com.br) → lookup in tenant_domains
 * 3. Known app hosts → skip (render normal app)
 *
 * Includes:
 * - sessionStorage cache (30min) to skip spinner on repeat visits
 * - per-RPC timeouts (8s) so a stalled Supabase call doesn't hang the page
 * - apex → preferred-hostname redirect (e.g. domain.com → www.domain.com)
 */
export function useTenantByHostname() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const platformSlug = extractPlatformSlug(hostname);
  const isCustomDomain = !!hostname && !isAppHost(hostname) && !platformSlug && hostname !== PLATFORM_DOMAIN;
  const isExternalDomain = !!platformSlug || isCustomDomain;

  const cached = isExternalDomain ? readCache(hostname) : null;

  // Resolve platform subdomain by slug
  const slugQuery = useQuery({
    queryKey: ["tenant-slug", platformSlug],
    enabled: !!platformSlug,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnReconnect: false,
    initialData: platformSlug && cached?.organizationId ? cached.organizationId : undefined,
    queryFn: async () => {
      const { data, error } = await withTimeout<any>(
        (supabase.rpc as any)("get_public_org_by_slug", { p_slug: platformSlug! }),
        RPC_TIMEOUT_MS,
        "get_public_org_by_slug",
      );
      if (error) throw error;
      const org = Array.isArray(data) ? data[0] : data;
      const id = (org?.id as string | null) ?? null;
      writeCache(hostname, id);
      return id;
    },
  });

  // Resolve custom domain via tenant_domains
  const domainQuery = useQuery({
    queryKey: ["tenant-domain", hostname],
    enabled: isCustomDomain,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnReconnect: false,
    initialData: isCustomDomain && cached?.organizationId ? cached.organizationId : undefined,
    queryFn: async () => {
      const { data, error } = await withTimeout<any>(
        (supabase.rpc as any)("get_public_tenant_by_domain", { p_hostname: hostname }),
        RPC_TIMEOUT_MS,
        "get_public_tenant_by_domain",
      );
      if (error) throw error;
      const id = (data?.organization_id as string | null) ?? null;
      writeCache(hostname, id);
      return id;
    },
  });

  const orgId = isExternalDomain
    ? (platformSlug ? slugQuery.data : domainQuery.data) ?? null
    : null;

  // Check if we should redirect to a preferred custom domain
  // (works for both platform subdomains AND custom apex → www).
  const redirectQuery = useQuery({
    queryKey: ["tenant-redirect", orgId, hostname],
    enabled: isExternalDomain && !!orgId,
    staleTime: 5 * 60_000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await withTimeout<any>(
        (supabase.rpc as any)("get_public_tenant_redirect", { p_org_id: orgId! }),
        RPC_TIMEOUT_MS,
        "get_public_tenant_redirect",
      );
      if (error) throw error;

      const shouldRedirect = data?.redirect_to_custom_domain ?? false;
      const customHostname = data?.custom_hostname ?? null;

      if (shouldRedirect && customHostname && customHostname !== hostname) {
        const path = window.location.pathname + window.location.search + window.location.hash;
        window.location.replace(`https://${customHostname}${path}`);
        return { redirecting: true };
      }

      return { redirecting: false };
    },
  });

  const activeQuery = platformSlug ? slugQuery : domainQuery;
  const isRedirecting = redirectQuery.data?.redirecting === true;

  // Loading: only when we have NO data yet AND query is fetching.
  // initialData from cache means we hit the ground running with no spinner.
  const activeIsResolving = activeQuery.isFetching && activeQuery.data == null;

  // notFound: only when query truly settled with empty data (not while refetching)
  const truthfulNotFound =
    isExternalDomain &&
    activeQuery.isFetched &&
    !activeQuery.isFetching &&
    !activeQuery.data &&
    !isRedirecting;

  // Telemetry: log when resolution takes too long
  if (isExternalDomain && activeQuery.error) {
    Sentry.captureMessage("[TenantRouter] tenant resolution failed", {
      level: "warning",
      tags: { hostname },
      extra: { error: String((activeQuery.error as any)?.message ?? activeQuery.error) },
    });
  }

  return {
    isExternalDomain,
    organizationId: orgId,
    isLoading: (isExternalDomain && activeIsResolving) || isRedirecting,
    notFound: truthfulNotFound,
    error: activeQuery.error ?? null,
  };
}
