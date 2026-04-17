import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { trackEvent } from '@/lib/posthog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeError } from '@/lib/normalizeError';
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;
export type PropertyType = Tables<'property_types'>;
export type PropertyImage = Tables<'property_images'>;

export interface PropertyWithDetails extends Property {
  property_type: PropertyType | null;
  images: PropertyImage[];
}

export type PropertyFormData = Omit<TablesInsert<'properties'>, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'created_by'>;

export interface ImageData {
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
  phash?: string;
  r2_key_full?: string;
  r2_key_thumb?: string;
  storage_provider?: string;
}

export interface OwnerData {
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
  notes?: string;
}

/**
 * Core CRUD operations for properties: list, create, update, delete.
 * For bulk/marketplace operations, see usePropertyBulkOps.
 */
export function usePropertyCRUD() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['properties', profile?.organization_id],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      if (!profile?.organization_id) return [];

      const allData: PropertyWithDetails[] = [];
      const PAGE_SIZE = 200;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id, title, property_code, status, transaction_type,
            sale_price, sale_price_financed, rent_price, condominium_fee, iptu, iptu_monthly, inspection_fee,
            commission_type, commission_value,
            bedrooms, bathrooms, parking_spots, area_total, area_useful, area_built, suites, floor,
            address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zipcode,
            latitude, longitude,
            description, property_type_id, organization_id, created_by, created_at, updated_at,
            featured, amenities, property_condition, launch_stage, development_name,
            beach_distance_meters, captador_id, payment_options, youtube_url, marketplace_contact_phone,
            property_type:property_types(id, name),
            images:property_images!left(id, url, is_cover, display_order, r2_key_full, r2_key_thumb, storage_provider, cached_thumbnail_url)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
          .abortSignal(signal!);

        if (error) throw error;

        const processed = (data as unknown as PropertyWithDetails[]).map(p => ({
          ...p,
          images: (p.images || []).sort((a: any, b: any) => {
            if (a.is_cover && !b.is_cover) return -1;
            if (!a.is_cover && b.is_cover) return 1;
            return (a.display_order || 0) - (b.display_order || 0);
          }),
        }));

        allData.push(...processed);

        if (!data || data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      return allData;
    },
    enabled: !!user && !!profile?.organization_id,
  });

  const createProperty = useMutation({
    mutationKey: ['properties', 'create'],
    mutationFn: async ({ propertyData, images, ownerData }: { propertyData: PropertyFormData; images: ImageData[]; ownerData?: OwnerData }) => {
      if (!profile?.organization_id) throw new Error('Usuário não está vinculado a uma organização');

      // Feature gate: check max_own_properties limit
      const { count: currentCount } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);

      const { getFeatureLimit: getLimit } = await import('@/hooks/useSubscription');
      const { data: activeSubData } = await supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('organization_id', profile.organization_id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let plan = activeSubData?.plan as any;
      if (!plan) {
        const { data: latestSubData } = await supabase
          .from('subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        plan = latestSubData?.plan as any;
      }

      const rawLimit = getLimit(plan, 'max_own_properties');
      const safeMinimumLimit = getLimit(undefined, 'max_own_properties');
      const limit = rawLimit === Infinity ? Infinity : Math.max(rawLimit, safeMinimumLimit);
      if (limit !== Infinity && (currentCount ?? 0) >= limit) {
        throw new Error(`Limite de ${limit} imóveis atingido no seu plano. Faça upgrade para adicionar mais.`);
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({ ...propertyData, organization_id: profile.organization_id, created_by: user!.id })
        .select()
        .single();
      if (error) throw normalizeError(error);

      // Save images (deduplicate by URL)
      if (images.length > 0) {
        const seenUrls = new Set<string>();
        const imagesToInsert = images
          .map((img, index) => ({
            property_id: data.id, url: img.url, is_cover: img.is_cover || index === 0,
            display_order: img.display_order ?? index,
            ...(img.phash ? { phash: img.phash } : {}),
            ...(img.r2_key_full ? { r2_key_full: img.r2_key_full } : {}),
            ...(img.r2_key_thumb ? { r2_key_thumb: img.r2_key_thumb } : {}),
            ...(img.storage_provider ? { storage_provider: img.storage_provider } : {}),
          }))
          .filter(img => { if (seenUrls.has(img.url)) return false; seenUrls.add(img.url); return true; });

        const CHUNK = 20;
        let totalSaved = 0;
        for (let i = 0; i < imagesToInsert.length; i += CHUNK) {
          const chunk = imagesToInsert.slice(i, i + CHUNK);
          const { error: imagesError, data: insertedData } = await supabase.from('property_images').insert(chunk).select('id');
          if (imagesError) {
            console.error(`[createProperty] Erro ao salvar imagens (chunk ${i / CHUNK + 1}):`, imagesError);
            toast({ title: 'Erro parcial ao salvar fotos', description: `${totalSaved} de ${imagesToInsert.length} fotos salvas. Erro: ${imagesError.message}`, variant: 'destructive' });
            break;
          }
          totalSaved += insertedData?.length || chunk.length;
        }
      }

      // Save owner
      await saveOwnerForProperty(data.id, profile.organization_id, ownerData);

      const { data: fullData } = await supabase
        .from('properties')
        .select(`*, property_type:property_types(*), images:property_images(*)`)
        .eq('id', data.id)
        .single();
      return fullData as PropertyWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      trackEvent('imovel_cadastrado');
      toast({ title: 'Imóvel cadastrado', description: 'O imóvel foi cadastrado com sucesso.' });
    },
    onError: (error) => {
      const norm = normalizeError(error);
      if (norm.code === '23505' && norm.constraint === 'properties_org_property_code_key') {
        toast({
          title: 'Conflito ao gerar código',
          description: 'O código do imóvel colidiu com outro recente. Tente salvar novamente — vamos gerar um novo código automaticamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao cadastrar imóvel',
          description: norm.userMessage || norm.message,
          variant: 'destructive',
        });
      }
    },
  });

  const updateProperty = useMutation({
    mutationKey: ['properties', 'update'],
    mutationFn: async ({ id, data, images, ownerData }: { id: string; data: TablesUpdate<'properties'>; images?: ImageData[]; ownerData?: OwnerData }) => {
      const { data: updated, error } = await supabase.from('properties').update(data).eq('id', id).select().single();
      if (error) throw normalizeError(error);

      if (images !== undefined) {
        await supabase.from('property_images').delete().eq('property_id', id);
        if (images.length > 0) {
          const seenUrls = new Set<string>();
          const imagesToInsert = images
            .map((img, index) => ({
              property_id: id, url: img.url, is_cover: img.is_cover || index === 0,
              display_order: img.display_order ?? index,
              ...(img.phash ? { phash: img.phash } : {}),
              ...(img.r2_key_full ? { r2_key_full: img.r2_key_full } : {}),
              ...(img.r2_key_thumb ? { r2_key_thumb: img.r2_key_thumb } : {}),
              ...(img.storage_provider ? { storage_provider: img.storage_provider } : {}),
            }))
            .filter(img => { if (seenUrls.has(img.url)) return false; seenUrls.add(img.url); return true; });

          const CHUNK = 20;
          let totalSaved = 0;
          for (let i = 0; i < imagesToInsert.length; i += CHUNK) {
            const chunk = imagesToInsert.slice(i, i + CHUNK);
            const { error: imagesError, data: insertedData } = await supabase.from('property_images').insert(chunk).select('id');
            if (imagesError) {
              console.error(`[updateProperty] Erro ao salvar imagens (chunk ${i / CHUNK + 1}):`, imagesError);
              toast({ title: 'Erro parcial ao salvar fotos', description: `${totalSaved} de ${imagesToInsert.length} fotos salvas. Erro: ${imagesError.message}`, variant: 'destructive' });
              break;
            }
            totalSaved += insertedData?.length || chunk.length;
          }
        }
      }

      // Update owner
      if (ownerData?.name) {
        await updateOwnerForProperty(id, profile?.organization_id, ownerData);
      }

      const { data: fullData } = await supabase
        .from('properties')
        .select(`*, property_type:property_types(*), images:property_images(*)`)
        .eq('id', id)
        .single();
      return fullData as PropertyWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({ title: 'Imóvel atualizado', description: 'O imóvel foi atualizado com sucesso.' });
    },
    onError: (error) => {
      const norm = normalizeError(error);
      toast({ title: 'Erro ao atualizar imóvel', description: norm.userMessage || norm.message, variant: 'destructive' });
    },
  });

  const deleteProperty = useMutation({
    mutationKey: ['properties', 'delete'],
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_property_cascade', { p_property_id: id });
      if (error) throw normalizeError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({ title: 'Imóvel removido', description: 'O imóvel foi removido com sucesso.' });
    },
    onError: (error) => {
      const norm = normalizeError(error);
      toast({ title: 'Erro ao remover imóvel', description: norm.userMessage || norm.message, variant: 'destructive' });
    },
  });

  return {
    properties, isLoading, error, refetch,
    createProperty: (propertyData: PropertyFormData, images: ImageData[] = [], ownerData?: OwnerData) =>
      createProperty.mutateAsync({ propertyData, images, ownerData }),
    updateProperty: (id: string, data: TablesUpdate<'properties'>, images?: ImageData[], ownerData?: OwnerData) =>
      updateProperty.mutateAsync({ id, data, images, ownerData }),
    deleteProperty: deleteProperty.mutateAsync,
    isCreating: createProperty.isPending,
    isUpdating: updateProperty.isPending,
    isDeleting: deleteProperty.isPending,
  };
}

// ── Owner helpers ──

async function saveOwnerForProperty(propertyId: string, organizationId: string, ownerData?: OwnerData) {
  if (!ownerData?.name) return;

  try {
    if (ownerData.phone) {
      const normPhone = ownerData.phone.replace(/[^0-9]/g, '');
      let ownerId: string | null = null;

      const { data: existingOwner } = await supabase.from('owners').select('id')
        .eq('organization_id', organizationId).eq('phone', normPhone).maybeSingle();

      if (existingOwner) {
        ownerId = existingOwner.id;
        const { data: existingAlias } = await supabase.from('owner_aliases').select('id, occurrence_count')
          .eq('owner_id', ownerId).eq('name', ownerData.name).maybeSingle();

        if (existingAlias) {
          await supabase.from('owner_aliases').update({ occurrence_count: (existingAlias.occurrence_count || 0) + 1 }).eq('id', existingAlias.id);
        } else {
          await supabase.from('owner_aliases').insert({ owner_id: ownerId, name: ownerData.name, occurrence_count: 1 });
        }

        const { data: topAlias } = await supabase.from('owner_aliases').select('name')
          .eq('owner_id', ownerId).order('occurrence_count', { ascending: false }).limit(1);
        if (topAlias?.[0]) {
          await supabase.from('owners').update({ primary_name: topAlias[0].name }).eq('id', ownerId);
        }
      } else {
        const { data: newOwner } = await supabase.from('owners').insert({
          organization_id: organizationId, primary_name: ownerData.name, phone: normPhone,
          email: ownerData.email || null, document: ownerData.document || null, notes: ownerData.notes || null,
        }).select('id').single();

        if (newOwner) {
          ownerId = newOwner.id;
          await supabase.from('owner_aliases').insert({ owner_id: newOwner.id, name: ownerData.name, occurrence_count: 1 });
        }
      }

      await supabase.from('property_owners').insert({
        property_id: propertyId, organization_id: organizationId,
        name: ownerData.name, phone: ownerData.phone || null, email: ownerData.email || null,
        document: ownerData.document || null, notes: ownerData.notes || null, is_primary: true, owner_id: ownerId,
      });
    } else {
      await supabase.from('property_owners').insert({
        property_id: propertyId, organization_id: organizationId,
        name: ownerData.name, phone: ownerData.phone || null, email: ownerData.email || null,
        document: ownerData.document || null, notes: ownerData.notes || null, is_primary: true,
      });
    }
  } catch (ownerError) {
    console.error('Erro ao salvar proprietário:', ownerError);
  }
}

async function updateOwnerForProperty(propertyId: string, organizationId: string | undefined, ownerData: OwnerData) {
  if (!ownerData.name) return;
  try {
    const { data: existingPO } = await supabase.from('property_owners').select('id')
      .eq('property_id', propertyId).eq('is_primary', true).maybeSingle();

    const ownerRecord = {
      name: ownerData.name, phone: ownerData.phone || null,
      email: ownerData.email || null, document: ownerData.document || null, notes: ownerData.notes || null,
    };

    if (existingPO) {
      await supabase.from('property_owners').update(ownerRecord).eq('id', existingPO.id);
    } else if (organizationId) {
      await supabase.from('property_owners').insert({
        ...ownerRecord, property_id: propertyId, organization_id: organizationId, is_primary: true,
      });
    }

    if (ownerData.phone && organizationId) {
      const normPhone = ownerData.phone.replace(/[^0-9]/g, '');
      const { data: existingOwner } = await supabase.from('owners').select('id')
        .eq('organization_id', organizationId).eq('phone', normPhone).maybeSingle();

      if (existingOwner) {
        const { data: existingAlias } = await supabase.from('owner_aliases').select('id, occurrence_count')
          .eq('owner_id', existingOwner.id).eq('name', ownerData.name).maybeSingle();

        if (existingAlias) {
          await supabase.from('owner_aliases').update({ occurrence_count: (existingAlias.occurrence_count || 0) + 1 }).eq('id', existingAlias.id);
        } else {
          await supabase.from('owner_aliases').insert({ owner_id: existingOwner.id, name: ownerData.name, occurrence_count: 1 });
        }

        const { data: topAlias } = await supabase.from('owner_aliases').select('name')
          .eq('owner_id', existingOwner.id).order('occurrence_count', { ascending: false }).limit(1);
        if (topAlias?.[0]) {
          await supabase.from('owners').update({ primary_name: topAlias[0].name }).eq('id', existingOwner.id);
        }

        if (existingPO) {
          await supabase.from('property_owners').update({ owner_id: existingOwner.id }).eq('id', existingPO.id);
        }
      }
    }
  } catch (ownerError) {
    console.error('Erro ao atualizar proprietário:', ownerError);
  }
}
