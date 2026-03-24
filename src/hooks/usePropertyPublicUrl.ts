import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Caches the org slug for the current session and builds /i/:orgSlug/:code URLs */
export function usePropertyPublicUrl() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: orgSlug = null } = useQuery({
    queryKey: ["org-slug", orgId],
    enabled: !!orgId,
    staleTime: 30 * 60_000, // 30 min — slug rarely changes
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

  /** Returns the short public URL or falls back to /imovel/:id */
  const buildPublicUrl = (propertyId: string, propertyCode?: string | null): string => {
    if (orgSlug && propertyCode) {
      return `${window.location.origin}/i/${orgSlug}/${propertyCode}`;
    }
    return `${window.location.origin}/imovel/${propertyId}`;
  };

  return { buildPublicUrl, orgSlug };
}
