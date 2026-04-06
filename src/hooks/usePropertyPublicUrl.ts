import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildOrgSubdomainUrl } from "@/config/platform";

/** Caches the org slug for the current session and builds public URLs */
export function usePropertyPublicUrl() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: orgSlug = null } = useQuery({
    queryKey: ["org-slug", orgId],
    enabled: !!orgId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", orgId!)
        .single();
      return data?.slug ?? null;
    },
  });

  /** Returns the public URL using the platform subdomain or falls back to /imovel/:id */
  const buildPublicUrl = (propertyId: string, propertyCode?: string | null): string => {
    if (orgSlug && propertyCode) {
      return `${buildOrgSubdomainUrl(orgSlug)}/imovel/${propertyCode}`;
    }
    if (orgSlug) {
      return `${buildOrgSubdomainUrl(orgSlug)}/imovel/${propertyId}`;
    }
    return `${window.location.origin}/imovel/${propertyId}`;
  };

  return { buildPublicUrl, orgSlug };
}
