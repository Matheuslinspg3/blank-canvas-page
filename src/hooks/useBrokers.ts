import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Broker = {
  id: string;
  user_id: string;
  full_name: string;
};

/**
 * Roles eligible to be assigned as lead responsible.
 * Must match the DB function public.is_lead_eligible_responsible.
 */
const ELIGIBLE_ROLES = ['corretor', 'admin', 'sub_admin', 'leader', 'developer'];

export function useBrokers() {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: brokers = [], isLoading, error } = useQuery({
    queryKey: ['brokers', orgId],
    staleTime: 10 * 60_000, // PERF: broker list rarely changes
    queryFn: async () => {
      if (!orgId) return [] as Broker[];

      // 1. Get user_ids with eligible roles
      const { data: eligibleRoles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ELIGIBLE_ROLES);

      if (rolesErr) throw rolesErr;
      const eligibleUserIds = new Set((eligibleRoles || []).map(r => r.user_id));

      // 2. Get profiles in the org
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('id, user_id, full_name, organization_id')
        .eq('organization_id', orgId)
        .order('full_name');

      if (error) throw error;

      // 3. Filter to only eligible users
      const filtered = ((data as unknown) as Broker[]).filter(
        (p) => eligibleUserIds.has(p.user_id)
      );

      return filtered;
    },
    enabled: !!user && !!orgId,
  });

  return {
    brokers,
    isLoading,
    error,
  };
}
