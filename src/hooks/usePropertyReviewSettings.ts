import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PropertyReviewSettings {
  overdueAfterDays: number;
  warningBeforeDays: number;
  showDashboardCard: boolean;
}

export const DEFAULT_REVIEW_SETTINGS: PropertyReviewSettings = {
  overdueAfterDays: 60,
  warningBeforeDays: 15,
  showDashboardCard: true,
};

/**
 * Pure helper — does NOT use hooks. Safe to call in render code anywhere
 * without triggering N+1 queries.
 */
export function classifyReview(
  lastReviewedAt: string | null | undefined,
  s: PropertyReviewSettings = DEFAULT_REVIEW_SETTINGS,
): 'fresh' | 'near_due' | 'overdue' | 'never' {
  if (!lastReviewedAt) return 'never';
  const days = Math.floor((Date.now() - new Date(lastReviewedAt).getTime()) / 86400000);
  if (days > s.overdueAfterDays) return 'overdue';
  if (days > s.overdueAfterDays - s.warningBeforeDays) return 'near_due';
  return 'fresh';
}

/**
 * Loads the property-review configuration for the current organization.
 * Returns DEFAULT_REVIEW_SETTINGS if the org has no row yet (no insert needed).
 *
 * Cached for 5 minutes so list pages can call this once and propagate the
 * settings down to every PropertyReviewBadge via prop (no N+1).
 */
export function usePropertyReviewSettings() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: ['property-review-settings', orgId],
    queryFn: async (): Promise<PropertyReviewSettings> => {
      if (!orgId) return DEFAULT_REVIEW_SETTINGS;
      const { data, error } = await supabase
        .from('property_review_settings')
        .select('overdue_after_days, warning_before_days, show_dashboard_card')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_REVIEW_SETTINGS;
      return {
        overdueAfterDays: data.overdue_after_days,
        warningBeforeDays: data.warning_before_days,
        showDashboardCard: data.show_dashboard_card,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });

  return {
    settings: query.data ?? DEFAULT_REVIEW_SETTINGS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
