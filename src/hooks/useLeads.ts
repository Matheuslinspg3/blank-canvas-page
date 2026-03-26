/**
 * Facade hook for backward compatibility.
 * Re-exports types and composes useLeadCRUD + useLeadBulkOps.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { useToast } from '@/hooks/use-toast';
import { useLeadStages, type LeadStage } from '@/hooks/useLeadStages';
import { useLeadCRUD } from './useLeadCRUD';
import { useLeadBulkOps } from './useLeadBulkOps';

// Re-export types for backward compatibility
export type { Lead, CreateLeadInput, UpdateLeadInput } from './useLeadCRUD';
export { type LeadStage } from '@/hooks/useLeadStages';

export const LEAD_SOURCES = [
  { id: 'site', label: 'Site' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'anuncio', label: 'Anúncio' },
  { id: 'indicacao', label: 'Indicação' },
  { id: 'porta', label: 'Porta' },
  { id: 'RD Station', label: 'RD Station (Sync)' },
  { id: 'RD Station (Webhook)', label: 'RD Station (Webhook)' },
  { id: 'outro', label: 'Outro' },
] as const;

export const TEMPERATURES = [
  { id: 'frio', label: 'Frio', color: 'text-blue-500' },
  { id: 'morno', label: 'Morno', color: 'text-amber-500' },
  { id: 'quente', label: 'Quente', color: 'text-orange-500' },
  { id: 'prioridade', label: 'Prioridade Máxima', color: 'text-red-500' },
] as const;

// Demo mode fallback stages
const DEMO_STAGES: LeadStage[] = [
  { id: 'novo', name: 'Novos', color: '#64748b', position: 0, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'contato', name: 'Em Contato', color: '#3b82f6', position: 1, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'visita', name: 'Visita Agendada', color: '#eab308', position: 2, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'proposta', name: 'Proposta', color: '#f97316', position: 3, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'negociacao', name: 'Negociação', color: '#a855f7', position: 4, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'fechado_ganho', name: 'Fechado Ganho', color: '#22c55e', position: 5, organization_id: null, is_default: true, is_win: true, is_loss: false, created_at: '' },
  { id: 'fechado_perdido', name: 'Fechado Perdido', color: '#ef4444', position: 6, organization_id: null, is_default: true, is_win: false, is_loss: true, created_at: '' },
];

export function useLeads() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const { leadStages: dynamicStages, isLoading: isLoadingStages } = useLeadStages();

  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-leads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      return (data || []).map((r: { role: string }) => r.role);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const isBrokerOnly = userRoles.length > 0 && userRoles.every(r => r === 'corretor' || r === 'assistente');

  const leadStages = isDemoMode ? DEMO_STAGES : dynamicStages;

  // Demo mode
  if (isDemoMode) {
    const demoLeads = demoData.leads as any[];
    const leadsByStage = leadStages.reduce((acc, stage) => {
      acc[stage.id] = demoLeads.filter(lead => lead.lead_stage_id === stage.id || lead.stage === stage.id);
      return acc;
    }, {} as Record<string, any[]>);
    const stageStats = leadStages.reduce((acc, stage) => {
      const stageLeads = leadsByStage[stage.id] || [];
      acc[stage.id] = { count: stageLeads.length, totalValue: stageLeads.reduce((sum: number, lead: any) => sum + (lead.estimated_value || 0), 0) };
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);
    const demoMutate = () => { toast({ title: 'Modo Demonstração', description: 'Os dados não serão salvos neste modo.' }); };

    return {
      leads: demoLeads, inactiveLeads: [] as any[], leadStages, leadsByStage, stageStats,
      isLoading: false, isLoadingInactive: false, error: null,
      refetch: () => Promise.resolve({ data: demoLeads, error: null }),
      createLead: demoMutate, createLeadAsync: async () => { demoMutate(); return demoLeads[0]; },
      updateLead: demoMutate, updateLeadAsync: async () => { demoMutate(); return demoLeads[0]; },
      updateLeadStage: demoMutate, reorderLeads: demoMutate,
      deleteLead: demoMutate, inactivateLead: demoMutate, reactivateLead: demoMutate,
      bulkDeleteLeads: demoMutate, bulkInactivateLeads: demoMutate, bulkMoveStage: demoMutate,
      isCreating: false, isUpdating: false, isDeleting: false, isInactivating: false, isReactivating: false,
    };
  }

  const crud = useLeadCRUD({ leadStages, isBrokerOnly });
  const bulk = useLeadBulkOps();

  const { leads, inactiveLeads, isLoadingLeads, isLoadingInactive, error, refetch } = crud;
  const isLoading = isLoadingLeads || isLoadingStages;

  // Group leads by stage
  const leadsByStage = leadStages.reduce((acc, stage) => {
    acc[stage.id] = leads.filter(lead => lead.lead_stage_id === stage.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return acc;
  }, {} as Record<string, typeof leads>);

  const unclassifiedLeads = leads
    .filter(lead => !lead.lead_stage_id || !leadStages.some(s => s.id === lead.lead_stage_id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  leadsByStage['__unclassified__'] = unclassifiedLeads;

  const stageStats = leadStages.reduce((acc, stage) => {
    const stageLeads = leadsByStage[stage.id] || [];
    acc[stage.id] = { count: stageLeads.length, totalValue: stageLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0) };
    return acc;
  }, {} as Record<string, { count: number; totalValue: number }>);
  stageStats['__unclassified__'] = {
    count: unclassifiedLeads.length,
    totalValue: unclassifiedLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
  };

  return {
    leads, inactiveLeads, leadStages, leadsByStage, stageStats,
    isLoading, isLoadingInactive: isLoadingInactive, error, refetch,
    createLead: crud.createLead.mutate,
    createLeadAsync: crud.createLead.mutateAsync,
    updateLead: crud.updateLead.mutate,
    updateLeadAsync: crud.updateLead.mutateAsync,
    updateLeadStage: crud.updateLeadStage.mutate,
    reorderLeads: bulk.reorderLeads.mutate,
    deleteLead: crud.deleteLead.mutate,
    inactivateLead: crud.inactivateLead.mutate,
    reactivateLead: crud.reactivateLead.mutate,
    bulkDeleteLeads: bulk.bulkDeleteLeads.mutate,
    bulkInactivateLeads: bulk.bulkInactivateLeads.mutate,
    bulkMoveStage: bulk.bulkMoveStage.mutate,
    isCreating: crud.createLead.isPending,
    isUpdating: crud.updateLead.isPending,
    isDeleting: crud.deleteLead.isPending,
    isInactivating: crud.inactivateLead.isPending,
    isReactivating: crud.reactivateLead.isPending,
  };
}
