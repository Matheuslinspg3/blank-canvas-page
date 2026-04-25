import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Mutation hook for marking a property as commercially reviewed.
 * Updates `properties.last_reviewed_at = now()` via the `mark_property_reviewed` RPC,
 * which enforces multi-tenant isolation server-side.
 *
 * Invalidates all real query keys related to the properties listing/cards/search.
 */
export function usePropertyReview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { data, error } = await supabase.rpc('mark_property_reviewed', {
        p_property_id: propertyId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, propertyId) => {
      qc.invalidateQueries({ queryKey: ['properties-list'] });
      qc.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['owner-property-ids'] });
      // Detalhe do imóvel específico (usado em /imoveis/:id e formulários)
      qc.invalidateQueries({ queryKey: ['property', propertyId] });
      qc.invalidateQueries({ queryKey: ['property-detail', propertyId] });
      toast.success('Imóvel marcado como revisado');
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Erro ao marcar como revisado');
    },
  });
}
