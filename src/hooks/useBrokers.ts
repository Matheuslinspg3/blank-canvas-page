import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Broker = {
  id: string;
  user_id: string;
  full_name: string;
};

export function useBrokers() {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: brokers = [], isLoading, error } = useQuery({
    queryKey: ['brokers', orgId],
    staleTime: 10 * 60_000, // PERF: broker list rarely changes
    queryFn: async () => {
      if (!orgId) return [] as Broker[];
      // profiles_public view already filters out removed_at IS NOT NULL and
      // organization_id IS NULL — we further scope to the caller's org.
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('id, user_id, full_name, organization_id')
        .eq('organization_id', orgId)
        .order('full_name');

      if (error) throw error;
      return (data as unknown) as Broker[];
    },
    enabled: !!user && !!orgId,
  });

  return {
    brokers,
    isLoading,
    error,
  };
}
