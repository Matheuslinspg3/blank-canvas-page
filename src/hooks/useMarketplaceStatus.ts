import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns a Set of property IDs that are published in the marketplace
 * for the current organization. Includes a `refetch` for callers that
 * need to force a fresh read (e.g. before opening the edit form).
 */
export function useMarketplaceStatus() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const query = useQuery({
    queryKey: ["marketplace-published-ids", orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>();
      const { data, error } = await supabase
        .from("marketplace_properties")
        .select("id")
        .eq("organization_id", orgId);

      if (error) throw error;
      return new Set((data || []).map((d) => d.id));
    },
    enabled: !!orgId,
    staleTime: 10_000,
  });

  return {
    publishedIds: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
