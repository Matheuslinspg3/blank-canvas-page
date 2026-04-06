import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KNOWN_APP_HOSTS = [
  "localhost",
  "lovable.app",
  "lovable.dev",
  "webcontainer.io",
];

function isAppHost(hostname: string): boolean {
  return KNOWN_APP_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

/**
 * Resolves the current hostname to an organization_id via tenant_domains.
 * Returns null quickly for known app hostnames (no DB query).
 */
export function useTenantByHostname() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isExternal = !!hostname && !isAppHost(hostname);

  const query = useQuery({
    queryKey: ["tenant-domain", hostname],
    enabled: isExternal,
    staleTime: 30 * 60_000, // 30 min — domains don't change often
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("organization_id")
        .eq("hostname", hostname)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data?.organization_id as string | null;
    },
  });

  return {
    isExternalDomain: isExternal,
    organizationId: isExternal ? (query.data ?? null) : null,
    isLoading: isExternal && query.isLoading,
    notFound: isExternal && query.isFetched && !query.data,
  };
}
