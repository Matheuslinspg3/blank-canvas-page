import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyFilters } from './usePropertyFilters';
import type { SortOption } from '@/components/properties/PropertyViewControls';

interface SearchResult {
  id: string;
  property_code: string | null;
  title: string;
  description: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  address_state: string | null;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  status: string;
  transaction_type: string;
  property_type_id: string | null;
  cover_image_url: string | null;
  beach_distance_meters: number | null;
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
  total_count: number;
}

export interface AdvancedSearchOptions {
  page?: number;
  pageSize?: number;
  sortBy?: SortOption;
}

export function useAdvancedPropertySearch(
  filters: PropertyFilters,
  enabled: boolean = true,
  options: AdvancedSearchOptions = {}
) {
  const { profile } = useAuth();
  const { page = 1, pageSize = 50, sortBy = 'recent' } = options;

  return useQuery({
    queryKey: ['properties-advanced-search', profile?.organization_id, filters, page, pageSize, sortBy],
    queryFn: async () => {
      if (!profile?.organization_id) return { rows: [] as SearchResult[], total: 0 };

      const offset = (page - 1) * pageSize;

      const { data, error } = await supabase.rpc('search_properties_advanced', {
        p_organization_id: profile.organization_id,
        p_search_text: filters.searchText || null,
        p_transaction_type: filters.transactionType === 'all' ? null : filters.transactionType,
        p_status: filters.status === 'all' ? null : filters.status,
        p_property_type_id: filters.propertyTypeId === 'all' ? null : filters.propertyTypeId,
        p_property_type_ids: filters.propertyTypeIds && filters.propertyTypeIds.length > 0 ? filters.propertyTypeIds : null,
        p_min_price: filters.minPrice,
        p_max_price: filters.maxPrice,
        p_min_bedrooms: filters.minBedrooms,
        p_neighborhood: null,
        p_city: null,
        p_neighborhoods: filters.neighborhoods.length > 0 ? filters.neighborhoods : null,
        p_cities: filters.cities.length > 0 ? filters.cities : null,
        p_min_area: filters.minArea,
        p_limit: pageSize,
        p_offset: offset,
        p_min_suites: filters.minSuites,
        p_min_parking: filters.minParking,
        p_max_area: filters.maxArea,
        p_min_condominium: filters.minCondominium,
        p_max_condominium: filters.maxCondominium,
        p_amenities: (() => {
          const ams = [...filters.amenities];
          if (filters.frenteMar && !ams.includes('Frente Mar')) ams.push('Frente Mar');
          return ams.length > 0 ? ams : null;
        })(),
        p_property_condition: filters.propertyCondition === 'all' ? null : filters.propertyCondition,
        p_max_beach_distance: filters.maxBeachDistance,
        p_launch_stage: filters.launchStage === 'all' ? null : filters.launchStage,
        p_sort_by: sortBy,
        p_owner_id: filters.ownerId || null,
        p_review_status: filters.reviewStatus && filters.reviewStatus !== 'all' ? filters.reviewStatus : null,
      });

      if (error) {
        console.error('Error searching properties:', error);
        throw error;
      }

      const rows = (data || []) as SearchResult[];
      const total = rows.length > 0 ? rows[0].total_count : 0;

      return { rows, total };
    },
    enabled: enabled && !!profile?.organization_id,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });
}
