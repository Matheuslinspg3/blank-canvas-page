import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConsumerFilters {
  city?: string;
  transactionType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}

export function useConsumerProperties(filters?: ConsumerFilters) {
  return useQuery({
    queryKey: ["consumer-properties", filters],
    staleTime: 3 * 60_000,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from("marketplace_properties_public")
        .select("id, title, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, parking_spots, area_total, address_city, address_neighborhood, address_state, images, is_featured, organization_id, created_at")
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(50)
        .abortSignal(signal!);

      if (filters?.city) {
        query = query.ilike("address_city", `%${filters.city}%`);
      }
      if (filters?.transactionType) {
        query = query.eq("transaction_type", filters.transactionType as "venda" | "aluguel" | "ambos");
      }
      if (filters?.bedrooms) {
        query = query.gte("bedrooms", filters.bedrooms);
      }
      if (filters?.minPrice) {
        query = query.or(`sale_price.gte.${filters.minPrice},rent_price.gte.${filters.minPrice}`);
      }
      if (filters?.maxPrice) {
        query = query.or(`sale_price.lte.${filters.maxPrice},rent_price.lte.${filters.maxPrice}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
