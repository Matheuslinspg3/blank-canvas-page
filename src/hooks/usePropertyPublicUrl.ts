import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildOrgSubdomainUrl } from "@/config/platform";

/** Caches the org slug + site active status and builds public URLs */
export function usePropertyPublicUrl() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: orgData = null } = useQuery({
    queryKey: ["org-site-info", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const [orgRes, siteRes, domainsRes] = await Promise.all([
        supabase.from("organizations").select("slug").eq("id", orgId!).single(),
        supabase
          .from("website_settings")
          .select("is_active, use_custom_domain_url")
          .eq("organization_id", orgId!)
          .maybeSingle(),
        supabase
          .from("tenant_domains")
          .select("hostname")
          .eq("organization_id", orgId!)
          .eq("is_active", true)
          .limit(1),
      ]);
      return {
        slug: orgRes.data?.slug ?? null,
        siteActive: siteRes.data?.is_active ?? false,
        useCustomDomainUrl: siteRes.data?.use_custom_domain_url ?? false,
        activeDomain: domainsRes.data?.[0]?.hostname ?? null,
      };
    },
  });

  const orgSlug = orgData?.slug ?? null;
  const siteActive = orgData?.siteActive ?? false;
  const useCustomDomain = orgData?.useCustomDomainUrl ?? false;
  const activeDomain = orgData?.activeDomain ?? null;

  /** Returns the public URL — uses custom domain or subdomain based on settings */
  const buildPublicUrl = (propertyId: string, propertyCode?: string | null): string => {
    if (!siteActive || !orgSlug) {
      return `${window.location.origin}/imovel/${propertyId}`;
    }

    const identifier = propertyCode || propertyId;
    const baseUrl =
      useCustomDomain && activeDomain
        ? `https://${activeDomain}`
        : buildOrgSubdomainUrl(orgSlug);

    return `${baseUrl}/imovel/${identifier}`;
  };

  return { buildPublicUrl, orgSlug, siteActive };
}
