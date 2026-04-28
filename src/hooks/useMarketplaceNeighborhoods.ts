import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dedupeByAccentKey } from "@/lib/normalizeText";

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

      // Dedupe ignorando caixa E acentos (ex.: "Mongaguá" e "Mongagua" → 1 item)
      return dedupeByAccentKey((data as any[]).map((d) => d.address_neighborhood));
    },
    enabled: !!profile?.organization_id,
  });
}
