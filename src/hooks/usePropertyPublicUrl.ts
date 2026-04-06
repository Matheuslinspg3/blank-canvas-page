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
      const [orgRes, siteRes] = await Promise.all([
        supabase.from("organizations").select("slug").eq("id", orgId!).single(),
        supabase.from("website_settings").select("is_active").eq("organization_id", orgId!).maybeSingle(),
      ]);
      return {
        slug: orgRes.data?.slug ?? null,
        siteActive: siteRes.data?.is_active ?? false,
      };
    },
  });

  const orgSlug = orgData?.slug ?? null;
  const siteActive = orgData?.siteActive ?? false;

  /** Returns the public URL — uses subdomain only when site is active */
  const buildPublicUrl = (propertyId: string, propertyCode?: string | null): string => {
    if (siteActive && orgSlug && propertyCode) {
      return `${buildOrgSubdomainUrl(orgSlug)}/imovel/${propertyCode}`;
    }
    if (siteActive && orgSlug) {
      return `${buildOrgSubdomainUrl(orgSlug)}/imovel/${propertyId}`;
    }
    // Site inactive or no slug — use app-relative URL
    return `${window.location.origin}/imovel/${propertyId}`;
  };

  return { buildPublicUrl, orgSlug, siteActive };
}
