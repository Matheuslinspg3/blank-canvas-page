import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database, Json } from '@/integrations/supabase/types';
import { getFeatureLimit } from '@/hooks/useSubscription';

/**
 * Bulk operations and marketplace publishing for properties.
 * Separated from usePropertyCRUD to reduce file size and blast radius.
 */

/**
 * Resolves the current marketplace publish limit for an organization, then
 * checks how many additional properties may still be published. Throws a
 * user-friendly error if the limit would be exceeded. `incomingIds` is the
 * set of property ids about to be published; ids already in the marketplace
 * count against the existing-published total but do not consume new slots.
 */
async function assertMarketplaceLimit(orgId: string, incomingIds: string[]) {
  const { data: subData } = await supabase
    .from('subscriptions')
    .select('plan:subscription_plans(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = (subData?.plan ?? null) as any;
  const limit = getFeatureLimit(plan, 'max_marketplace_properties');
  if (limit === Infinity) return;

  // Existing published ids for this org
  const { data: published } = await supabase
    .from('marketplace_properties')
    .select('id')
    .eq('organization_id', orgId);
  const publishedIds = new Set((published ?? []).map((r: { id: string }) => r.id));
  const incomingNew = incomingIds.filter((id) => !publishedIds.has(id)).length;
  const total = publishedIds.size + incomingNew;
  if (total > limit) {
    const remaining = Math.max(0, limit - publishedIds.size);
    throw new Error(
      `Limite de ${limit} imóveis publicados no Marketplace atingido no seu plano. ` +
        `Você pode publicar mais ${remaining}. Faça upgrade para publicar mais.`,
    );
  }
}

export function usePropertyBulkOps() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['properties-list'] });
    queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
  };

  const bulkDeleteProperties = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) throw new Error('Usuário não está vinculado a uma organização');
      if (!ids?.length) throw new Error('Selecione ao menos 1 imóvel para continuar.');

      type LogBulkOperationArgs = Database['public']['Functions']['log_bulk_operation']['Args'];
      type LogBulkOperationEntityIds = LogBulkOperationArgs['p_entity_ids'];

      try {
        const logArgs: LogBulkOperationArgs = {
          p_org_id: profile.organization_id, p_action: 'bulk_delete', p_entity_type: 'properties',
          p_entity_ids: ids as unknown as LogBulkOperationEntityIds, p_details: { count: ids.length } as Json,
        };
        await supabase.rpc('log_bulk_operation', logArgs);
      } catch (logError) { console.warn('Failed to log bulk operation:', logError); }

      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);

        const depResults = await Promise.allSettled([
          supabase.from('property_images').delete().in('property_id', chunk),
          supabase.from('property_media').delete().in('property_id', chunk),
          supabase.from('property_owners').delete().in('property_id', chunk),
          supabase.from('property_visibility').delete().in('property_id', chunk),
          supabase.from('property_partnerships').delete().in('property_id', chunk),
          supabase.from('property_landing_content').delete().in('property_id', chunk),
          supabase.from('property_landing_overrides').delete().in('property_id', chunk),
          supabase.from('property_share_links').delete().in('property_id', chunk),
          supabase.from('property_status_history').delete().in('property_id', chunk),
          supabase.from('property_visits').delete().in('property_id', chunk),
          supabase.from('property_groups').delete().in('source_property_id', chunk),
          supabase.from('import_run_items').delete().in('property_id', chunk),
          supabase.from('anuncios_gerados').delete().in('property_id', chunk),
          supabase.from('generated_arts').delete().in('property_id', chunk),
          supabase.from('generated_videos').delete().in('property_id', chunk),
          supabase.from('simulacoes_financiamento').delete().in('imovel_id', chunk),
          supabase.from('whatsapp_property_rules').delete().in('property_id', chunk),
          supabase.from('marketplace_contact_access').delete().in('marketplace_property_id', chunk),
          supabase.from('marketplace_properties').delete().in('id', chunk),
        ]);
        depResults.forEach((r, idx) => {
          if (r.status === 'rejected') console.warn(`Dependency cleanup ${idx} failed:`, r.reason);
          else if (r.value?.error) console.warn(`Dependency cleanup ${idx} error:`, r.value.error.message);
        });

        const refResults = await Promise.allSettled([
          supabase.from('leads').update({ property_id: null }).in('property_id', chunk),
          supabase.from('contracts').update({ property_id: null }).in('property_id', chunk),
          supabase.from('appointments').update({ property_id: null }).in('property_id', chunk),
        ]);
        refResults.forEach((r, i) => {
          if (r.status === 'rejected') console.warn(`Reference cleanup ${i} failed:`, r.reason);
          else if (r.value?.error) console.warn(`Reference cleanup ${i} error:`, r.value.error.message);
        });

        const { error } = await supabase.from('properties').delete().in('id', chunk);
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: (count) => { invalidateAll(); toast({ title: 'Imóveis removidos', description: `${count} imóvel(is) removido(s) com sucesso.` }); },
    onError: (error) => { toast({ title: 'Erro ao remover imóveis', description: error.message, variant: 'destructive' }); },
  });

  const bulkInactivateProperties = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) throw new Error('Usuário não está vinculado a uma organização');
      if (!ids?.length) throw new Error('Selecione ao menos 1 imóvel para continuar.');

      type LogBulkOperationArgs = Database['public']['Functions']['log_bulk_operation']['Args'];
      type LogBulkOperationEntityIds = LogBulkOperationArgs['p_entity_ids'];

      try {
        const logArgs: LogBulkOperationArgs = {
          p_org_id: profile.organization_id, p_action: 'bulk_inactivate', p_entity_type: 'properties',
          p_entity_ids: ids as unknown as LogBulkOperationEntityIds, p_details: { count: ids.length } as Json,
        };
        await supabase.rpc('log_bulk_operation', logArgs);
      } catch (logError) { console.warn('Failed to log bulk operation:', logError); }

      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('properties').update({ status: 'inativo' }).in('id', chunk);
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: (count) => { invalidateAll(); toast({ title: 'Imóveis inativados', description: `${count} imóvel(is) inativado(s) com sucesso.` }); },
    onError: (error) => { toast({ title: 'Erro ao inativar imóveis', description: error.message, variant: 'destructive' }); },
  });

  const publishToMarketplace = useMutation({
    mutationFn: async (propertyId: string) => {
      if (!profile?.organization_id) throw new Error('Usuário não está vinculado a uma organização');

      // Feature gate: enforce max_marketplace_properties from active plan.
      await assertMarketplaceLimit(profile.organization_id, [propertyId]);

      toast({ title: '📤 Publicando no Marketplace...', description: 'Processando em segundo plano.' });

      const { data: prop, error: propError } = await supabase
        .from('properties')
        .select(`*, property_type:property_types(*), images:property_images(*)`)
        .eq('id', propertyId).single();
      if (propError || !prop) throw new Error('Imóvel não encontrado');

      const { data: ownerData } = await supabase.from('property_owners').select('name, phone, email')
        .eq('property_id', propertyId).eq('is_primary', true).maybeSingle();

      const imageUrls = prop.images?.map(img => img.url) || [];

      const { error } = await supabase.from('marketplace_properties').upsert({
        id: propertyId, title: prop.title, description: prop.description,
        property_type_id: prop.property_type_id, transaction_type: prop.transaction_type,
        sale_price: prop.sale_price, rent_price: prop.rent_price,
        address_street: prop.address_street, address_number: prop.address_number,
        address_complement: prop.address_complement, address_neighborhood: prop.address_neighborhood,
        address_city: prop.address_city, address_state: prop.address_state, address_zipcode: prop.address_zipcode,
        bedrooms: prop.bedrooms || 0, suites: prop.suites || 0, bathrooms: prop.bathrooms || 0, parking_spots: prop.parking_spots || 0,
        area_total: prop.area_total, area_built: prop.area_built, amenities: prop.amenities,
        images: imageUrls, owner_name: ownerData?.name || null, owner_phone: ownerData?.phone || null,
        owner_email: ownerData?.email || null, status: prop.status,
        external_code: (prop as any).property_code || null, commission_percentage: (prop as any).commission_value || null,
        sale_price_financed: (prop as any).sale_price_financed ? Math.round((prop as any).sale_price_financed) : null,
        payment_options: (prop as any).payment_options || null,
        marketplace_contact_phone: (prop as any).marketplace_contact_phone || null,
        marketplace_contact_phone_source: (prop as any).marketplace_contact_phone_source || 'organization',
        is_featured: false, organization_id: profile.organization_id,
      } as any, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({ title: '✅ Publicado no Marketplace', description: 'O imóvel foi publicado no marketplace com sucesso.' });
    },
    onError: (error) => { toast({ title: 'Erro ao publicar no marketplace', description: error.message, variant: 'destructive' }); },
  });

  const bulkPublishToMarketplace = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) throw new Error('Usuário não está vinculado a uma organização');
      if (!ids?.length) throw new Error('Selecione ao menos 1 imóvel para continuar.');

      // Feature gate: enforce max_marketplace_properties from active plan.
      await assertMarketplaceLimit(profile.organization_id, ids);

      toast({ title: '📤 Publicando no Marketplace...', description: `Publicando ${ids.length} imóvel(is) em segundo plano.` });

      const CHUNK = 50;
      const allProps: any[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data } = await supabase.from('properties').select(`*, property_type:property_types(*), images:property_images(*)`).in('id', chunk);
        if (data) allProps.push(...data);
      }

      const { data: allOwners } = await supabase.from('property_owners').select('property_id, name, phone, email').in('property_id', ids).eq('is_primary', true);
      const ownerMap = new Map((allOwners || []).map(o => [o.property_id, o]));

      const rows = allProps.map(prop => {
        const owner = ownerMap.get(prop.id);
        const imageUrls = (prop.images as any[])?.map((img: any) => img.url) || [];
        return {
          id: prop.id, title: prop.title, description: prop.description,
          property_type_id: prop.property_type_id, transaction_type: prop.transaction_type,
          sale_price: prop.sale_price, rent_price: prop.rent_price,
          address_street: prop.address_street, address_number: prop.address_number,
          address_complement: prop.address_complement, address_neighborhood: prop.address_neighborhood,
          address_city: prop.address_city, address_state: prop.address_state, address_zipcode: prop.address_zipcode,
          bedrooms: prop.bedrooms || 0, suites: prop.suites || 0, bathrooms: prop.bathrooms || 0, parking_spots: prop.parking_spots || 0,
          area_total: prop.area_total, area_built: prop.area_built, amenities: prop.amenities,
          images: imageUrls, owner_name: owner?.name || null, owner_phone: owner?.phone || null,
          owner_email: owner?.email || null, status: prop.status,
          external_code: prop.property_code || null, commission_percentage: prop.commission_value || null,
          sale_price_financed: (prop as any).sale_price_financed ? Math.round((prop as any).sale_price_financed) : null,
          payment_options: (prop as any).payment_options || null,
          marketplace_contact_phone: (prop as any).marketplace_contact_phone || null,
          marketplace_contact_phone_source: (prop as any).marketplace_contact_phone_source || 'organization',
          is_featured: false, organization_id: profile.organization_id,
        };
      });

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from('marketplace_properties').upsert(chunk as any, { onConflict: 'id' });
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({ title: '✅ Publicados no Marketplace', description: `${count} imóvel(is) publicado(s) com sucesso.` });
    },
    onError: (error) => { toast({ title: 'Erro ao publicar no marketplace', description: error.message, variant: 'destructive' }); },
  });

  const bulkHideFromMarketplace = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids?.length) throw new Error('Selecione ao menos 1 imóvel para continuar.');
      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('marketplace_properties').delete().in('id', chunk);
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({ title: 'Removidos do Marketplace', description: `${count} imóvel(is) removido(s) do marketplace.` });
    },
    onError: (error) => { toast({ title: 'Erro ao remover do marketplace', description: error.message, variant: 'destructive' }); },
  });

  // Single-id unpublish — reuses the bulk delete route to avoid duplication.
  const hideFromMarketplace = useMutation({
    mutationFn: async (id: string) => {
      if (!id) throw new Error('ID do imóvel é obrigatório.');
      const { error } = await supabase.from('marketplace_properties').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({ title: 'Removido do Marketplace', description: 'O imóvel não aparece mais no marketplace.' });
    },
    onError: (error) => { toast({ title: 'Erro ao remover do marketplace', description: error.message, variant: 'destructive' }); },
  });

  return {
    bulkDeleteProperties: bulkDeleteProperties.mutateAsync,
    bulkInactivateProperties: bulkInactivateProperties.mutateAsync,
    publishToMarketplace: publishToMarketplace.mutateAsync,
    bulkPublishToMarketplace: bulkPublishToMarketplace.mutateAsync,
    bulkHideFromMarketplace: bulkHideFromMarketplace.mutateAsync,
    hideFromMarketplace: hideFromMarketplace.mutateAsync,
    isBulkDeleting: bulkDeleteProperties.isPending,
    isBulkInactivating: bulkInactivateProperties.isPending,
    isPublishing: publishToMarketplace.isPending,
    isBulkPublishing: bulkPublishToMarketplace.isPending,
    isBulkHiding: bulkHideFromMarketplace.isPending,
    isHiding: hideFromMarketplace.isPending,
  };
}
