import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

export interface StreetOption {
  street: string;
  neighborhood: string | null;
  city: string | null;
  count: number;
}

export interface UsePropertyStreetsOptions {
  /** Search term (min 3 chars to trigger) */
  searchTerm: string;
  /** Optional filter by selected cities */
  cities?: string[];
  /** Optional filter by selected neighborhoods */
  neighborhoods?: string[];
}

const MAX_STREET_LENGTH = 100;
const MIN_SEARCH_LENGTH = 3;
const MAX_RESULTS = 10;

/**
 * Sanitize input: trim, collapse whitespace, remove dangerous chars, truncate.
 */
function sanitizeStreetInput(input: string): string {
  return input
    .trim()
    .replace(/[<>'";\-\-{}()\\]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_STREET_LENGTH);
}

export function usePropertyStreets(options: UsePropertyStreetsOptions) {
  const { profile } = useAuth();
  const { searchTerm, cities = [], neighborhoods = [] } = options;

  const sanitized = sanitizeStreetInput(searchTerm);
  const debouncedTerm = useDebounce(sanitized, 300);
  const enabled = !!profile?.organization_id && debouncedTerm.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: ['property-streets', profile?.organization_id, debouncedTerm, cities, neighborhoods],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let q = supabase
        .from('properties')
        .select('address_street, address_neighborhood, address_city')
        .eq('organization_id', profile.organization_id)
        .not('address_street', 'is', null)
        .neq('address_street', '')
        .ilike('address_street', `%${debouncedTerm}%`);

      if (cities.length > 0) {
        q = q.in('address_city', cities);
      }
      if (neighborhoods.length > 0) {
        q = q.in('address_neighborhood', neighborhoods);
      }

      // Only fetch status-active properties
      q = q.in('status', ['disponivel', 'com_proposta', 'reservado']);

      const { data, error } = await q.limit(200);
      if (error) throw error;

      // Group by street and count
      const streetMap = new Map<string, StreetOption>();
      for (const row of data || []) {
        const street = row.address_street as string;
        const key = street.toLowerCase().trim();
        const existing = streetMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          streetMap.set(key, {
            street,
            neighborhood: row.address_neighborhood,
            city: row.address_city,
            count: 1,
          });
        }
      }

      // Sort by count desc, limit to MAX_RESULTS
      return Array.from(streetMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_RESULTS);
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    streets: query.data ?? [],
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching,
    isEnabled: enabled,
    error: query.error,
  };
}
