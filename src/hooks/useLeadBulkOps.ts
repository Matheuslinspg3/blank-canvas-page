import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from './useLeadCRUD';

/**
 * Bulk operations for leads: bulk delete, bulk inactivate, bulk move stage, reorder.
 */
export function useLeadBulkOps() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  /** Helper: exact query key for the active leads list */
  const leadsKey = ['leads', profile?.organization_id] as const;

  const bulkDeleteLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').update({ is_active: false }).in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(leadsKey, (old) => (old || []).filter(l => !idSet.has(l.id)));
      return { previous };
    },
    onSuccess: (_d, ids) => { toast({ title: 'Leads removidos', description: `${ids.length} lead(s) removido(s) com sucesso.` }); },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(leadsKey, context.previous);
      toast({ title: 'Erro ao remover leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' }),
  });

  const bulkInactivateLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').update({ is_active: false }).in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(leadsKey, (old) => (old || []).filter(l => !idSet.has(l.id)));
      return { previous };
    },
    onSuccess: (_d, ids) => { toast({ title: 'Leads inativados', description: `${ids.length} lead(s) movido(s) para inativos.` }); },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(leadsKey, context.previous);
      toast({ title: 'Erro ao inativar leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' }),
  });

  const bulkMoveStage = useMutation({
    mutationFn: async ({ ids, lead_stage_id }: { ids: string[]; lead_stage_id: string }) => {
      const { error } = await supabase.from('leads').update({ lead_stage_id }).in('id', ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, lead_stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(leadsKey, (old) =>
        (old || []).map(l => idSet.has(l.id) ? { ...l, lead_stage_id } : l)
      );
      return { previous };
    },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(leadsKey, context.previous);
      toast({ title: 'Erro ao mover leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' }),
  });

  const reorderLeads = useMutation({
    mutationFn: async (updates: { id: string; position: number; lead_stage_id: string }[]) => {
      const promises = updates.map(({ id, position, lead_stage_id }) =>
        supabase.from('leads').update({ position, lead_stage_id }).eq('id', id)
      );
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData<Lead[]>(leadsKey);
      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(leadsKey, (old) => {
          if (!old) return old;
          const updateMap = new Map(updates.map(u => [u.id, u]));
          return old.map(lead => {
            const update = updateMap.get(lead.id);
            return update ? { ...lead, position: update.position, lead_stage_id: update.lead_stage_id } : lead;
          });
        });
      }
      return { previousLeads };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLeads) queryClient.setQueryData(leadsKey, context.previousLeads);
      toast({ title: 'Erro ao reordenar leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' }); },
  });

  return {
    bulkDeleteLeads, bulkInactivateLeads, bulkMoveStage, reorderLeads,
  };
}
