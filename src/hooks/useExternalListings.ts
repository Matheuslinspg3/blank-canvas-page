import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";

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
  neighborhood?: string;
  transactionType?: string;
  bedrooms?: number;
  appliedAt?: number;
}

export function useExternalListings(filters: ExternalFilters) {
  const [n8nTriggered, setN8nTriggered] = useState(false);
  const [pollingStart, setPollingStart] = useState<number | null>(null);

  const enabled = typeof filters.appliedAt === "number";

  const query = useQuery({
    queryKey: ["external-listings", filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "external-listings-sync",
        {
          body: {
            city: filters.city || undefined,
            neighborhood: filters.neighborhood || undefined,
            transaction_type: filters.transactionType || undefined,
            bedrooms: filters.bedrooms || undefined,
          },
        },
      );

      if (error) throw error;

      const listings = (data?.listings ?? []) as ExternalListing[];
      const triggered = data?.n8n_triggered === true;

      if (triggered && listings.length === 0) {
        setN8nTriggered(true);
        setPollingStart((prev) => prev ?? Date.now());
      } else {
        setN8nTriggered(false);
        setPollingStart(null);
      }

      return listings;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: () => {
      if (!n8nTriggered || !pollingStart) return false;
      if (Date.now() - pollingStart > 60_000) return false;
      return 10_000;
    },
  });

  useEffect(() => {
    setN8nTriggered(false);
    setPollingStart(null);
  }, [filters.appliedAt]);

  const isPolling = n8nTriggered && !!pollingStart && (Date.now() - pollingStart <= 60_000);

  return { ...query, isPolling };
}
