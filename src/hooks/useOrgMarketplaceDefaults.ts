import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrgMarketplacePhoneSource = "organization" | "owner";

const FALLBACK: OrgMarketplacePhoneSource = "organization";

/**
 * Fetches the organization-level default for the Marketplace contact phone source.
 * - Used as default ONLY for newly created properties when the form/payload does
 *   not provide an explicit `marketplace_contact_phone_source`.
 * - Never overrides values saved on existing properties.
 */
export function useOrgMarketplaceDefaults() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: ["org-marketplace-defaults", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OrgMarketplacePhoneSource> => {
      if (!orgId) return FALLBACK;
      const { data, error } = await supabase
        .from("organizations")
        .select("marketplace_default_contact_phone_source")
        .eq("id", orgId)
        .maybeSingle();
      if (error) {
        // Fail-soft to keep previous behavior intact
        console.warn("[useOrgMarketplaceDefaults] failed to load:", error);
        return FALLBACK;
      }
      const raw = (data as any)?.marketplace_default_contact_phone_source;
      return raw === "owner" ? "owner" : "organization";
    },
  });

  return {
    defaultSource: (query.data ?? FALLBACK) as OrgMarketplacePhoneSource,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    refetch: query.refetch,
  };
}
