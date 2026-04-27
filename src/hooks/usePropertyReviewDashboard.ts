import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CriticalProperty {
  id: string;
  title: string | null;
  property_code: string | null;
  status: string;
  last_reviewed_at: string | null;
  days_since: number | null;
  priority: number; // 1 = never, 2 = overdue, 3 = near_due
  owner_name: string | null;
}

export interface PropertyReviewDashboard {
  overdue_count: number;
  never_count: number;
  warning_count: number;
  overdue_after_days: number;
  warning_before_days: number;
  critical: CriticalProperty[];
}

/**
 * Fetches the property-review dashboard summary via the
 * `get_property_review_dashboard` RPC (SECURITY DEFINER, multi-tenant safe).
 *
 * The client never passes `organization_id` — it is derived from auth.uid() server-side.
 *
 * Pass `enabled: false` when the user disabled the dashboard card to avoid
 * calling the RPC at all.
 */
export function usePropertyReviewDashboard(opts: { enabled?: boolean; limit?: number } = {}) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id ?? null;
  const enabled = opts.enabled !== false && !!orgId;
  const limit = opts.limit ?? 10;

  return useQuery<PropertyReviewDashboard>({
    queryKey: ['property-review-dashboard', orgId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_property_review_dashboard', {
        p_limit: limit,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Partial<PropertyReviewDashboard>;
      return {
        overdue_count: payload.overdue_count ?? 0,
        never_count: payload.never_count ?? 0,
        warning_count: payload.warning_count ?? 0,
        overdue_after_days: payload.overdue_after_days ?? 60,
        warning_before_days: payload.warning_before_days ?? 15,
        critical: payload.critical ?? [],
      };
    },
    enabled,
    staleTime: 2 * 60_000,
  });
}
