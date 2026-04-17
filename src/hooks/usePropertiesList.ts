/**
 * Lightweight hook for the Properties listing page.
 * Fetches ONLY card-essential fields with server-side pagination + cover image
 * via the materialized `cover_image_url` column. Avoids the heavy join with
 * property_images that `usePropertyCRUD` performs.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PropertyWithDetails } from './usePropertyCRUD';

export interface PropertiesListOptions {
  /** Page size for server-side pagination. */
  pageSize?: number;
  /** Zero-based page index. */
  page?: number;
  /** Disable the query (e.g. when an advanced search is active). */
  enabled?: boolean;
}

const CARD_FIELDS = `
  id, title, property_code, status, transaction_type,
  sale_price, sale_price_financed, rent_price, condominium_fee, iptu,
  bedrooms, bathrooms, parking_spots, area_total, area_useful, area_built, suites,
  address_neighborhood, address_city, address_state,
  latitude, longitude,
  property_type_id, organization_id, created_at, updated_at,
  featured, amenities, property_condition, launch_stage, development_name,
  beach_distance_meters, cover_image_url,
  property_type:property_types(id, name)
`;

export function usePropertiesList(options: PropertiesListOptions = {}) {
  const { profile } = useAuth();
  const { pageSize = 500, page = 0, enabled = true } = options;

  const query = useQuery({
    queryKey: ['properties-list', profile?.organization_id, page, pageSize],
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    enabled: enabled && !!profile?.organization_id,
    queryFn: async ({ signal }) => {
      if (!profile?.organization_id) return { rows: [] as PropertyWithDetails[], total: 0 };

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('properties')
        .select(CARD_FIELDS, { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
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
