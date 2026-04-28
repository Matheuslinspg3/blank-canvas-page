import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAccentsKey } from "@/lib/normalizeText";

interface ConsumerFilters {
  /** Legacy single-city (mantido por compat). Quando informado entra como ilike. */
  city?: string;
  /** Multi-select de cidades (OR). */
  cities?: string[];
  /** Multi-select de bairros (OR). */
  neighborhoods?: string[];
  /** Multi-select de tipo de imóvel (ids). */
  propertyTypeIds?: string[];
  transactionType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}

/**
 * Expande variações com/sem acento de uma lista de strings, para que um filtro
 * por nome canônico pegue também as variações persistidas no banco.
 */
function expandAccentVariants(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    set.add(v);
    set.add(normalizeAccentsKey(v));
  }
  return Array.from(set);
}

export function useConsumerProperties(filters?: ConsumerFilters) {
  return useQuery({
    queryKey: ["consumer-properties", filters],
    staleTime: 3 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from("marketplace_properties_public")
        .select(
          "id, title, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, parking_spots, area_total, address_city, address_neighborhood, address_state, images, is_featured, organization_id, property_type_id, created_at"
        )
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(50)
        .abortSignal(signal!);

      // Cidade legada (uma só, ilike) — mantido para compat. Multi-cidades tem prioridade.
      if (filters?.cities && filters.cities.length > 0) {
        query = query.in("address_city", expandAccentVariants(filters.cities));
      } else if (filters?.city) {
        query = query.ilike("address_city", `%${filters.city}%`);
      }

      if (filters?.neighborhoods && filters.neighborhoods.length > 0) {
        query = query.in("address_neighborhood", expandAccentVariants(filters.neighborhoods));
      }

      if (filters?.propertyTypeIds && filters.propertyTypeIds.length > 0) {
        query = query.in("property_type_id", filters.propertyTypeIds);
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
