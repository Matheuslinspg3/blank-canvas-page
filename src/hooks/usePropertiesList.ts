/**
 * Lightweight hook for the Properties listing page.
 * Fetches ONLY card-essential fields with server-side pagination + sorting
 * via the materialized `cover_image_url` column. Avoids the heavy join with
 * property_images that `usePropertyCRUD` performs.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PropertyWithDetails } from './usePropertyCRUD';
import type { SortOption } from '@/components/properties/PropertyViewControls';

export interface PropertiesListOptions {
  /** Page size for server-side pagination. */
  pageSize?: number;
  /** One-based page index. */
  page?: number;
  /** Server-side sort key. */
  sortBy?: SortOption;
  /** Disable the query (e.g. when an advanced search is active). */
  enabled?: boolean;
  /** Optional fallback owner filter (primary path is the RPC). */
  ownerId?: string | null;
}

const CARD_FIELDS = `
  id, title, property_code, status, transaction_type,
  sale_price, sale_price_financed, rent_price, condominium_fee, iptu,
  bedrooms, bathrooms, parking_spots, area_total, area_useful, area_built, suites,
  address_neighborhood, address_city, address_state,
  latitude, longitude,
  property_type_id, organization_id, created_at, updated_at, last_reviewed_at,
  featured, amenities, property_condition, launch_stage, development_name,
  beach_distance_meters, cover_image_url,
  property_type:property_types(id, name)
`;

/** Map UI sort options to Supabase .order() params */
function getSortParams(sortBy: SortOption): { column: string; ascending: boolean } {
  switch (sortBy) {
    case 'oldest': return { column: 'created_at', ascending: true };
    case 'price_asc': return { column: 'sale_price', ascending: true };
    case 'price_desc': return { column: 'sale_price', ascending: false };
    case 'beach_asc': return { column: 'beach_distance_meters', ascending: true };
    case 'beach_desc': return { column: 'beach_distance_meters', ascending: false };
    case 'recent':
    default: return { column: 'created_at', ascending: false };
  }
}

export function usePropertiesList(options: PropertiesListOptions = {}) {
  const { profile } = useAuth();
  const { pageSize = 50, page = 1, sortBy = 'recent', enabled = true, ownerId = null } = options;

  const query = useQuery({
    queryKey: ['properties-list', profile?.organization_id, page, pageSize, sortBy, ownerId ?? null],
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    enabled: enabled && !!profile?.organization_id,
    queryFn: async ({ signal }) => {
      if (!profile?.organization_id) return { rows: [] as PropertyWithDetails[], total: 0 };

      // Owner fallback: pre-fetch property_ids in batches to avoid the 1000-row limit.
      let ownerIdsFilter: string[] | null = null;
      if (ownerId) {
        const ids: string[] = [];
        const PAGE = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('property_owners')
            .select('property_id')
            .eq('owner_id', ownerId)
            .eq('organization_id', profile.organization_id)
            .range(from, from + PAGE - 1)
            .abortSignal(signal!);
          if (error) throw error;
          const batch = (data || []).map((d: any) => d.property_id).filter(Boolean);
          ids.push(...batch);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
        ownerIdsFilter = Array.from(new Set(ids));
        if (ownerIdsFilter.length === 0) {
          return { rows: [] as PropertyWithDetails[], total: 0 };
        }
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const sort = getSortParams(sortBy);

      let q = supabase
        .from('properties')
        .select(CARD_FIELDS, { count: 'exact' })
        .eq('organization_id', profile.organization_id);

      if (ownerIdsFilter) {
        q = q.in('id', ownerIdsFilter);
      }

      const { data, error, count } = await q
        .order(sort.column, { ascending: sort.ascending })
        .range(from, to)
        .abortSignal(signal!);

      if (error) throw error;

      const rows = (data || []).map((p: any) => ({
        ...p,
        // Materialise the same shape the rest of the UI expects: an `images` array
        // containing only the cover (if any). Heavy fields stay out.
        images: p.cover_image_url
          ? [{ url: p.cover_image_url, is_cover: true, display_order: 0 }]
          : [],
      })) as unknown as PropertyWithDetails[];

      return { rows, total: count ?? rows.length };
    },
  });

  return {
    properties: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
