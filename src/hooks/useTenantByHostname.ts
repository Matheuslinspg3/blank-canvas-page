import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractPlatformSlug, PLATFORM_DOMAIN } from "@/config/platform";

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

/**
 * Resolves the current hostname to an organization_id.
 *
 * 1. Platform subdomains ({slug}.portadocorretor.com.br) → lookup by slug
 * 2. Custom domains (www.clientsite.com.br) → lookup in tenant_domains
 * 3. Known app hosts → skip (render normal app)
 *
 * Also handles redirect when redirect_to_custom_domain is enabled.
 */
export function useTenantByHostname() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const platformSlug = extractPlatformSlug(hostname);
  const isCustomDomain = !!hostname && !isAppHost(hostname) && !platformSlug && hostname !== PLATFORM_DOMAIN;
  const isExternalDomain = !!platformSlug || isCustomDomain;

  // Resolve platform subdomain by slug
  const slugQuery = useQuery({
    queryKey: ["tenant-slug", platformSlug],
    enabled: !!platformSlug,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async () => {
      // Use public RPC to bypass RLS for anonymous visitors
      const { data, error } = await (supabase.rpc as any)("get_public_org_by_slug", {
        p_slug: platformSlug!,
      });
      if (error) throw error;
      return data?.id as string | null;
    },
  });

  // Resolve custom domain via tenant_domains
  const domainQuery = useQuery({
    queryKey: ["tenant-domain", hostname],
    enabled: isCustomDomain,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async () => {
      // Use public RPC to bypass RLS for anonymous visitors
      const { data, error } = await (supabase.rpc as any)("get_public_tenant_by_domain", {
        p_hostname: hostname,
      });
      if (error) throw error;
      return data?.organization_id as string | null;
    },
  });

  // Check if subdomain should redirect to custom domain
  const orgId = isExternalDomain
    ? (platformSlug ? slugQuery.data : domainQuery.data) ?? null
    : null;

  const redirectQuery = useQuery({
    queryKey: ["tenant-redirect", orgId, platformSlug],
    enabled: !!platformSlug && !!orgId,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async () => {
      // Use public RPC to bypass RLS for anonymous visitors
      const { data, error } = await (supabase.rpc as any)("get_public_tenant_redirect", {
        p_org_id: orgId!,
      });
      if (error) throw error;

      const shouldRedirect = data?.redirect_to_custom_domain ?? false;
      const customHostname = data?.custom_hostname ?? null;

      if (shouldRedirect && customHostname) {
        const path = window.location.pathname + window.location.search + window.location.hash;
        window.location.replace(`https://${customHostname}${path}`);
        return { redirecting: true };
      }

      return { redirecting: false };
    },
  });

  const activeQuery = platformSlug ? slugQuery : domainQuery;
  const isRedirecting = redirectQuery.data?.redirecting === true;

  return {
    isExternalDomain,
    organizationId: orgId,
    isLoading: (isExternalDomain && activeQuery.isLoading) || isRedirecting,
    notFound: isExternalDomain && activeQuery.isFetched && !activeQuery.data && !isRedirecting,
  };
}