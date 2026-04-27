import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { trackEvent } from '@/lib/posthog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { LeadStage } from '@/hooks/useLeadStages';

export type Lead = Tables<'leads'> & {
  lead_type?: Tables<'lead_types'> | null;
  property?: { id: string; title: string } | null;
  broker?: { id: string; full_name: string } | null;
  interested_property_type?: Tables<'property_types'> | null;
};

export type CreateLeadInput = {
  name: string;
  phone?: string;
  email?: string;
  lead_type_id?: string;
  source?: string;
  interested_property_type_id?: string;
  interested_property_type_ids?: string[];
  property_id?: string;
  broker_id?: string;
  estimated_value?: number;
  lead_stage_id?: string;
  notes?: string;
  temperature?: string;
  transaction_interest?: string;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_parking?: number;
  min_area?: number;
  preferred_neighborhoods?: string[];
  preferred_cities?: string[];
  additional_requirements?: string;
  consent_voice_call?: boolean;
};

export type UpdateLeadInput = Partial<CreateLeadInput> & { id: string };

/**
 * Core CRUD for leads: list (active + inactive), create, update, delete, inactivate, reactivate.
 */
export function useLeadCRUD(opts: {
  leadStages: LeadStage[];
  isBrokerOnly: boolean;
  isCorretorOnly?: boolean;
  isAssistenteOnly?: boolean;
}) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { leadStages, isBrokerOnly, isCorretorOnly = false, isAssistenteOnly = false } = opts;

  const isRlsError = (e: any) =>
    e?.code === '42501' || /row-level security/i.test(e?.message ?? '');

  const { data: leads = [], isLoading: isLoadingLeads, error, refetch } = useQuery({
    queryKey: ['leads', profile?.organization_id],
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, phone, email, source, temperature, estimated_value,
          lead_stage_id, stage, position, property_id, broker_id,
          lead_type_id, interested_property_type_id, transaction_interest,
          notes, is_active, organization_id, created_by, created_at, updated_at,
          conversion_identifier, traffic_source,
          lead_type:lead_types(id, name),
          interested_property_type:property_types(id, name)
        `)
        .eq('is_active', true)
        .order('position', { ascending: true })
        .abortSignal(signal!);
      if (error) throw error;

      const propertyIds = [...new Set(data.filter(l => l.property_id).map(l => l.property_id!))];
      const brokerIds = [...new Set(data.filter(l => l.broker_id).map(l => l.broker_id!))];

      const [propertiesResult, brokersResult] = await Promise.all([
        propertyIds.length > 0
          ? supabase.from('properties').select('id, title').in('id', propertyIds).abortSignal(signal!)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        brokerIds.length > 0
          ? supabase.from('profiles_public' as any).select('id, user_id, full_name').in('user_id', brokerIds).abortSignal(signal!)
          : Promise.resolve({ data: [] }),
      ]);

      const propertiesMap: Record<string, { id: string; title: string }> = Object.fromEntries(
        (propertiesResult.data || []).map(p => [p.id, p])
      );
      const brokersMap: Record<string, { id: string; full_name: string }> = Object.fromEntries(
        ((brokersResult.data as unknown) as { id: string; user_id: string; full_name: string }[] || [])
          .map(b => [b.user_id, { id: b.user_id, full_name: b.full_name }])
      );

      const mapped = data.map(lead => ({
        ...lead,
        property: lead.property_id ? propertiesMap[lead.property_id] || null : null,
        broker: lead.broker_id ? brokersMap[lead.broker_id] || null : null,
      })) as Lead[];

      if (isBrokerOnly && user) {
        return mapped.filter(l => l.broker_id === user.id);
      }
      return mapped;
    },
    enabled: !!user,
  });

  const { data: inactiveLeads = [], isLoading: isLoadingInactive } = useQuery({
    queryKey: ['leads', 'inactive', profile?.organization_id],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, phone, email, source, temperature, estimated_value,
          lead_stage_id, stage, position, property_id, broker_id,
          lead_type_id, interested_property_type_id, transaction_interest,
          notes, is_active, organization_id, created_by, created_at, updated_at,
          conversion_identifier, traffic_source,
          lead_type:lead_types(id, name),
          interested_property_type:property_types(id, name)
        `)
        .eq('is_active', false)
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { ascending: false })
        .limit(100)
        .abortSignal(signal!);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user && !!profile?.organization_id,
  });

  const createLead = useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      if (!user || !profile?.organization_id) throw new Error('Usuário não autenticado');

      const { count: currentCount } = await supabase
        .from('leads').select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id).eq('is_active', true);

      const { getFeatureLimit: getLimit } = await import('@/hooks/useSubscription');
      const { data: subData } = await supabase
        .from('subscriptions').select('*, plan:subscription_plans(*)')
        .eq('organization_id', profile.organization_id).in('status', ['active', 'trial'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      const plan = subData?.plan as any;
      const limit = getLimit(plan, 'max_leads');
      if (limit !== Infinity && (currentCount ?? 0) >= limit) {
        throw new Error(`Limite de ${limit} leads atingido no seu plano. Faça upgrade para adicionar mais.`);
      }

      const { lead_stage_id, ...rest } = input;
      const defaultStageId = leadStages[0]?.id;

      // Gate por papel — corretor vs assistente
      const payload: Record<string, any> = { ...rest };
      if (isCorretorOnly) {
        if (payload.broker_id && payload.broker_id !== user.id) {
          throw new Error('Corretores não podem atribuir leads diretamente para outro responsável.');
        }
        payload.broker_id = user.id;
      } else if (isAssistenteOnly) {
        if (payload.broker_id) {
          throw new Error('Assistentes não podem atribuir leads diretamente para outro responsável.');
        }
        // mantém broker_id ausente → NULL
      }

      const insertRow = {
        ...payload,
        organization_id: profile.organization_id,
        created_by: user.id, // sobrescrito pelo trigger; mantido para satisfazer o tipo
        lead_stage_id: lead_stage_id || defaultStageId,
        stage: 'novo',
      } as any;
      const { data, error } = await supabase.from('leads').insert(insertRow).select(`*, lead_type:lead_types(*)`).single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      trackEvent('lead_enviado');
      toast({ title: 'Lead criado', description: 'O lead foi criado com sucesso.' });
    },
    onError: (error: any) => {
      const isDuplicate = error.message?.includes('Lead duplicado');
      if (isRlsError(error)) {
        console.error('[leads.create] RLS denied', { code: error.code, orgId: profile?.organization_id, userId: user?.id });
        toast({ title: 'Permissão negada', description: 'Você não tem permissão para criar este lead.', variant: 'destructive' });
        return;
      }
      toast({
        title: isDuplicate ? 'Lead duplicado' : 'Erro ao criar lead',
        description: isDuplicate
          ? 'Já existe um lead ativo com este telefone ou e-mail na sua organização.'
          : error.message,
        variant: 'destructive',
      });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...input }: UpdateLeadInput) => {
      const { data, error } = await supabase.from('leads').update(input).eq('id', id)
        .select(`*, lead_type:lead_types(*)`).single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      toast({ title: 'Lead atualizado', description: 'O lead foi atualizado com sucesso.' });
    },
    onError: (error) => { toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' }); },
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, lead_stage_id }: { id: string; lead_stage_id: string }) => {
      const { data, error } = await supabase.from('leads').update({ lead_stage_id }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, lead_stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData<Lead[]>(['leads']);
      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(['leads'], (old) =>
          (old || []).map(lead => lead.id === id ? { ...lead, lead_stage_id, updated_at: new Date().toISOString() } : lead)
        );
      }
      return { previousLeads };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLeads) queryClient.setQueryData(['leads'], context.previousLeads);
      toast({ title: 'Erro ao mover lead', description: error.message, variant: 'destructive' });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' }); },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      toast({ title: 'Lead removido', description: 'O lead foi removido com sucesso.' });
    },
    onError: (error) => { toast({ title: 'Erro ao remover lead', description: error.message, variant: 'destructive' }); },
  });

  const inactivateLead = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const updateData: Record<string, any> = {
        is_active: false, inactivated_at: new Date().toISOString(),
        inactivated_by: profile?.full_name || user?.email || null,
      };
      if (reason) updateData.inactivation_reason = reason;
      const { error } = await supabase.from('leads').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      toast({ title: 'Lead inativado', description: 'O lead foi movido para a lista de inativos.' });
    },
    onError: (error) => { toast({ title: 'Erro ao inativar lead', description: error.message, variant: 'destructive' }); },
  });

  const reactivateLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      toast({ title: 'Lead reativado', description: 'O lead foi movido de volta para o Kanban.' });
    },
    onError: (error) => { toast({ title: 'Erro ao reativar lead', description: error.message, variant: 'destructive' }); },
  });

  return {
    leads, inactiveLeads, isLoadingLeads, isLoadingInactive, error, refetch,
    createLead, updateLead, updateLeadStage, deleteLead, inactivateLead, reactivateLead,
  };
}
