import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PropertyReviewSettings } from './usePropertyReviewSettings';

/**
 * Upserts the property-review configuration for the current organization.
 * RLS on `property_review_settings` enforces that only admin/sub_admin/leader/developer
 * of the same org can write — UI must also gate the action.
 */
export function useUpdatePropertyReviewSettings() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.organization_id ?? null;

  return useMutation({
    mutationFn: async (input: PropertyReviewSettings) => {
      if (!orgId) throw new Error('Sem organização ativa.');
      if (input.warningBeforeDays >= input.overdueAfterDays) {
        throw new Error('O aviso deve ser menor que o prazo de desatualização.');
      }
      const { error } = await supabase
        .from('property_review_settings')
        .upsert(
          {
            organization_id: orgId,
            overdue_after_days: input.overdueAfterDays,
            warning_before_days: input.warningBeforeDays,
            show_dashboard_card: input.showDashboardCard,
          },
          { onConflict: 'organization_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-review-settings', orgId] });
      qc.invalidateQueries({ queryKey: ['property-review-dashboard', orgId] });
      qc.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      qc.invalidateQueries({ queryKey: ['properties-list'] });
      toast.success('Configuração de revisão atualizada');
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Erro ao salvar configuração');
    },
  });
}
