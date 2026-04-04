import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExternalListing {
  id: string;
  source: "olx" | "vivareal" | "chavesnamao" | "zapimoveis";
  source_url: string;
  title: string;
  description: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  address_state: string | null;
  transaction_type: string | null;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  images: string[];
  contact_phone: string | null;
  contact_name: string | null;
}

interface ExternalFilters {
  city?: string;
  transactionType?: string;
  bedrooms?: number;
}

export function useExternalListings(filters: ExternalFilters) {
  return useQuery({
    queryKey: ["external-listings", filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "external-listings-sync",
        {
          body: {
            city: filters.city || undefined,
            transaction_type: filters.transactionType || undefined,
            bedrooms: filters.bedrooms || undefined,
          },
        },
      );

      if (error) throw error;
      return (data?.listings ?? []) as ExternalListing[];
    },
    enabled: !!(filters.city || filters.transactionType || filters.bedrooms),
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
}
