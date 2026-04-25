import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AdLeadStatus = 'new' | 'read' | 'sent_to_crm' | 'send_failed' | 'archived';

export interface AdLead {
  id: string;
  organization_id: string;
  provider: 'meta' | 'google';
  external_lead_id: string;
  external_ad_id: string;
  external_form_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_time: string;
  status: AdLeadStatus;
  status_reason: string | null;
  raw_payload: any;
  crm_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdLeads(filters?: { externalAdId?: string; status?: AdLeadStatus; search?: string }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['ad-leads', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      // COST OPT: exclude raw_payload (large JSON column) from default query.
      let query = supabase
        .from('ad_leads')
        .select('id, organization_id, provider, external_lead_id, external_ad_id, external_form_id, name, email, phone, created_time, status, status_reason, crm_record_id, created_at, updated_at')
        .eq('organization_id', profile.organization_id)
        .order('created_time', { ascending: false });

      if (filters?.externalAdId) {
        query = query.eq('external_ad_id', filters.externalAdId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdLead[];
    },
    enabled: !!profile?.organization_id,
  });

  const newLeadsCount = leads.filter(l => l.status === 'new').length;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, statusReason }: { id: string; status: AdLeadStatus; statusReason?: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (statusReason !== undefined) updateData.status_reason = statusReason;
      const { error } = await supabase.from('ad_leads').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ad-leads-count'] });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const sendToCrm = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead || !profile?.organization_id) throw new Error('Lead não encontrado');

      // Resolve ad/adset/campaign names from ad_entities to attach Meta Ads "tag"
      let adName: string | null = null;
      let adsetName: string | null = null;
      let campaignName: string | null = null;
      if (lead.external_ad_id && lead.external_ad_id !== 'unknown') {
        const { data: adRow } = await supabase
          .from('ad_entities')
          .select('name, parent_external_id')
          .eq('organization_id', profile.organization_id)
          .eq('provider', 'meta')
          .eq('entity_type', 'ad')
          .eq('external_id', lead.external_ad_id)
          .maybeSingle();
        adName = adRow?.name ?? null;
        if (adRow?.parent_external_id) {
          const { data: adsetRow } = await supabase
            .from('ad_entities')
            .select('name, parent_external_id')
            .eq('organization_id', profile.organization_id)
            .eq('provider', 'meta')
            .eq('entity_type', 'adset')
            .eq('external_id', adRow.parent_external_id)
            .maybeSingle();
          adsetName = adsetRow?.name ?? null;
          if (adsetRow?.parent_external_id) {
            const { data: campaignRow } = await supabase
              .from('ad_entities')
              .select('name')
              .eq('organization_id', profile.organization_id)
              .eq('provider', 'meta')
              .eq('entity_type', 'campaign')
              .eq('external_id', adsetRow.parent_external_id)
              .maybeSingle();
            campaignName = campaignRow?.name ?? null;
          }
        }
      }
      const tag = adName || campaignName || 'Meta Ads';
      const noteParts = ['Lead importado de Meta Ads'];
      if (campaignName) noteParts.push(`Campanha: ${campaignName}`);
      if (adsetName) noteParts.push(`Conjunto: ${adsetName}`);
      if (adName) noteParts.push(`Anúncio: ${adName}`);
      if (lead.external_ad_id && lead.external_ad_id !== 'unknown') noteParts.push(`Ad ID: ${lead.external_ad_id}`);

      // Try cross-channel merge first: if lead with same email/phone exists in last 30 days,
      // attach Meta Ads as a secondary source instead of creating a duplicate.
      const { data: mergedId, error: mergeError } = await supabase.rpc('merge_external_lead', {
        p_organization_id: profile.organization_id,
        p_email: lead.email,
        p_phone: lead.phone,
        p_external_source: 'meta_ads',
        p_source: tag,
        p_traffic_source: campaignName || 'Meta Ads',
        p_conversion_identifier: adName,
        p_external_id: lead.external_lead_id ?? null,
        p_window_days: 30,
      });
      if (mergeError) throw mergeError;

      let crmLeadId: string | null = (mergedId as string | null) ?? null;

      if (!crmLeadId) {
        // No existing match — create new CRM lead
        const { data: crmLead, error: crmError } = await supabase
          .from('leads')
          .insert({
            name: lead.name || 'Lead de Anúncio',
            email: lead.email,
            phone: lead.phone,
            organization_id: profile.organization_id,
            created_by: (await supabase.auth.getUser()).data.user!.id,
            lead_stage_id: stageId,
            stage: 'novo',
            source: tag,
            external_source: 'meta_ads',
            conversion_identifier: adName,
            traffic_source: campaignName || 'Meta Ads',
            notes: noteParts.join(' • '),
          })
          .select('id')
          .single();

        if (crmError) {
          await supabase.from('ad_leads').update({
            status: 'send_failed' as any,
            status_reason: crmError.message,
            updated_at: new Date().toISOString(),
          }).eq('id', leadId);
          throw crmError;
        }
        crmLeadId = crmLead.id;
      }

      if (crmError) {
        // Mark as failed
        await supabase.from('ad_leads').update({
          status: 'send_failed' as any,
          status_reason: crmError.message,
          updated_at: new Date().toISOString(),
        }).eq('id', leadId);
        throw crmError;
      }

      // Mark as sent
      await supabase.from('ad_leads').update({
        status: 'sent_to_crm' as any,
        crm_record_id: crmLead.id,
        updated_at: new Date().toISOString(),
      }).eq('id', leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ad-leads-count'] });
      queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      toast({ title: 'Enviado ao CRM', description: 'Lead enviado ao CRM com sucesso.' });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      toast({ title: 'Falha ao enviar ao CRM', description: error.message, variant: 'destructive' });
    },
  });

  return {
    leads,
    isLoading,
    refetch,
    newLeadsCount,
    updateStatus: updateStatus.mutate,
    sendToCrm: sendToCrm.mutate,
    isSending: sendToCrm.isPending,
  };
}

export function useAdLeadsCount(externalAdId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['ad-leads-count', profile?.organization_id, externalAdId],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      let query = supabase
        .from('ad_leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'new' as any);

      if (externalAdId) {
        query = query.eq('external_ad_id', externalAdId);
      }

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!profile?.organization_id,
  });
}
