import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function deduplicateCaseInsensitive(items: string[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.set(key, item.trim());
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function usePropertyLocations() {
  const { user } = useAuth();

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['property-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('address_neighborhood')
        .not('address_neighborhood', 'is', null)
        .order('address_neighborhood');

      if (error) throw error;
      return deduplicateCaseInsensitive(
        data.map(d => d.address_neighborhood!).filter(Boolean)
      );
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['property-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('address_city')
        .not('address_city', 'is', null)
        .order('address_city');

      if (error) throw error;
      return deduplicateCaseInsensitive(
        data.map(d => d.address_city!).filter(Boolean)
      );
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { neighborhoods, cities };
}
