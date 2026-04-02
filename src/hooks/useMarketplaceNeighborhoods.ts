import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMarketplaceNeighborhoods(city?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["marketplace-neighborhoods", city],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("address_neighborhood")
        .eq("status", "disponivel")
        .not("address_neighborhood", "is", null);

      if (profile?.organization_id) {
        query = query.neq("organization_id", profile.organization_id);
      }

      if (city) {
        query = query.ilike("address_city", `%${city}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Case-insensitive deduplication
      const seen = new Map<string, string>();
      for (const d of data as any[]) {
        const val = d.address_neighborhood?.trim();
        if (val) {
          const key = val.toLowerCase();
          if (!seen.has(key)) seen.set(key, val);
        }
      }

      return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
    enabled: !!profile?.organization_id,
  });
}
