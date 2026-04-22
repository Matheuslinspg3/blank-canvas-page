import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { normalizeError } from '@/lib/normalizeError';
import { sanitizePropertyInsert } from '@/lib/validatePropertyColumns';
import type { PropertyWithDetails } from '@/hooks/useProperties';

export interface VariationRow {
  id: string; // local row id
  property_code: string;
  unit_label: string; // unidade/lote/bloco
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_useful: number | null;
  area_total: number | null;
  sale_price: number | null;
  status: string;
  notes: string;
}

export interface VariationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface BatchResult {
  created: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
  strippedColumns: string[];
  groupId?: string;
}

export function usePropertyBatchCreate() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Validate codes against DB
  const validateCodes = async (codes: string[]): Promise<Set<string>> => {
    if (codes.length === 0) return new Set();
    const { data } = await supabase
      .from('properties')
      .select('property_code')
      .eq('organization_id', profile!.organization_id!)
      .in('property_code', codes);
    return new Set((data || []).map((p: any) => p.property_code));
  };

  // Validate rows locally + against DB
  const validateRows = async (rows: VariationRow[]): Promise<VariationError[]> => {
    const errors: VariationError[] = [];
    const nonEmptyRows = rows.filter(r => !isRowEmpty(r));

    // Check for duplicate codes within batch
    const codeMap = new Map<string, number[]>();
    nonEmptyRows.forEach((row, i) => {
      if (row.property_code) {
        const key = row.property_code.trim().toLowerCase();
        if (!codeMap.has(key)) codeMap.set(key, []);
        codeMap.get(key)!.push(i);
      }
    });
    codeMap.forEach((indices, code) => {
      if (indices.length > 1) {
        indices.forEach(i => errors.push({ rowIndex: i, field: 'property_code', message: `Código "${code}" duplicado no lote` }));
      }
    });

    // Check for duplicate unit_label within batch
    const unitMap = new Map<string, number[]>();
    nonEmptyRows.forEach((row, i) => {
      if (row.unit_label) {
        const key = row.unit_label.trim().toLowerCase();
        if (!unitMap.has(key)) unitMap.set(key, []);
        unitMap.get(key)!.push(i);
      }
    });
    unitMap.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(i => errors.push({ rowIndex: i, field: 'unit_label', message: 'Unidade duplicada no lote' }));
      }
    });

    // Validate codes against DB
    const codes = nonEmptyRows.map(r => r.property_code).filter(Boolean);
    if (codes.length > 0) {
      const existingCodes = await validateCodes(codes);
      nonEmptyRows.forEach((row, i) => {
        if (row.property_code && existingCodes.has(row.property_code)) {
          errors.push({ rowIndex: i, field: 'property_code', message: `Código "${row.property_code}" já existe` });
        }
      });
    }

    return errors;
  };

  const mutation = useMutation({
    mutationFn: async ({ baseProperty, rows }: { baseProperty: PropertyWithDetails; rows: VariationRow[] }) => {
      if (!profile?.organization_id || !user?.id) throw new Error('Não autenticado');

      const nonEmptyRows = rows.filter(r => !isRowEmpty(r));
      if (nonEmptyRows.length === 0) throw new Error('Nenhuma variação para criar');

      // 1. Create property group
      const { data: group, error: groupError } = await supabase
        .from('property_groups')
        .insert({
          organization_id: profile.organization_id,
          source_property_id: baseProperty.id,
          name: baseProperty.title || 'Grupo de variações',
          created_by: user.id,
        })
        .select('id')
        .single();
      if (groupError) throw normalizeError(groupError);

      // 2. Fetch base property images
      const { data: baseImages } = await supabase
        .from('property_images')
        .select('url, is_cover, display_order, phash, r2_key_full, r2_key_thumb, storage_provider')
        .eq('property_id', baseProperty.id)
        .order('display_order');

      // 3. Fetch base property owner
      const { data: baseOwner } = await supabase
        .from('property_owners')
        .select('name, phone, email, document, notes')
        .eq('property_id', baseProperty.id)
        .eq('is_primary', true)
        .maybeSingle();

      // 4. Build base data (strip identity/system fields)
      const p = baseProperty as any;
      const baseData = {
        title: p.title,
        description: p.description,
        transaction_type: p.transaction_type,
        property_type_id: p.property_type_id,
        condominium_fee: p.condominium_fee,
        iptu: p.iptu,
        iptu_monthly: p.iptu_monthly,
        floor: p.floor,
        address_street: p.address_street,
        address_number: p.address_number,
        address_complement: p.address_complement,
        address_neighborhood: p.address_neighborhood,
        address_city: p.address_city,
        address_state: p.address_state,
        address_zipcode: p.address_zipcode,
        latitude: p.latitude,
        longitude: p.longitude,
        amenities: p.amenities,
        featured: false,
        commission_value: p.commission_value,
        commission_type: p.commission_type,
        inspection_fee: p.inspection_fee,
        launch_stage: p.launch_stage,
        development_name: p.development_name,
        property_condition: p.property_condition,
        beach_distance_meters: p.beach_distance_meters,
        captador_id: p.captador_id,
        payment_options: p.payment_options,
        sale_price_financed: p.sale_price_financed,
        youtube_url: p.youtube_url,
        rent_price: p.rent_price,
        description_generated: false,
      };

      // 5. Insert properties sequentially
      const result: BatchResult = { created: 0, failed: 0, errors: [], strippedColumns: [], groupId: group.id };
      const allStrippedColumns = new Set<string>();
      const CHUNK = 20;

      for (let i = 0; i < nonEmptyRows.length; i++) {
        const row = nonEmptyRows[i];
        try {
          const titleSuffix = row.unit_label ? ` - ${row.unit_label}` : ` (${i + 1})`;
          // Append row notes to description (properties table has no 'notes' column)
          let finalDescription = baseData.description || '';
          if (row.notes) {
            finalDescription = finalDescription
              ? `${finalDescription}\n\nObservações: ${row.notes}`
              : row.notes;
          }

          const insertData = {
            ...baseData,
            title: `${baseData.title || 'Imóvel'}${titleSuffix}`,
            description: finalDescription || null,
            property_code: row.property_code || undefined,
            bedrooms: row.bedrooms ?? p.bedrooms,
            suites: row.suites ?? p.suites,
            bathrooms: row.bathrooms ?? p.bathrooms,
            parking_spots: row.parking_spots ?? p.parking_spots,
            area_useful: row.area_useful ?? p.area_useful,
            area_total: row.area_total ?? p.area_total,
            sale_price: row.sale_price ?? p.sale_price,
            status: row.status || 'disponivel',
            organization_id: profile.organization_id,
            created_by: user.id,
            property_group_id: group.id,
          };

          // Validate columns before insert
          const { clean: safeInsertData, invalidColumns } = sanitizePropertyInsert(insertData as Record<string, unknown>);
          if (invalidColumns.length > 0) {
            console.warn(`[BatchCreate] Linha ${i + 1}: colunas ignoradas: ${invalidColumns.join(', ')}`);
          }

          const { data: newProp, error: propError } = await supabase
            .from('properties')
            .insert(safeInsertData as any)
            .select('id')
            .single();
          if (propError) throw propError;

          // Copy images
          if (baseImages && baseImages.length > 0) {
            const seenUrls = new Set<string>();
            const imagesToInsert = baseImages
              .map((img: any, idx: number) => ({
                property_id: newProp.id,
                url: img.url,
                is_cover: img.is_cover || idx === 0,
                display_order: img.display_order ?? idx,
                ...(img.phash ? { phash: img.phash } : {}),
                ...(img.r2_key_full ? { r2_key_full: img.r2_key_full } : {}),
                ...(img.r2_key_thumb ? { r2_key_thumb: img.r2_key_thumb } : {}),
                ...(img.storage_provider ? { storage_provider: img.storage_provider } : {}),
              }))
              .filter((img: any) => { if (seenUrls.has(img.url)) return false; seenUrls.add(img.url); return true; });

            for (let c = 0; c < imagesToInsert.length; c += CHUNK) {
              const chunk = imagesToInsert.slice(c, c + CHUNK);
              await supabase.from('property_images').insert(chunk);
            }
          }

          // Copy owner
          if (baseOwner?.name) {
            await supabase.from('property_owners').insert({
              property_id: newProp.id,
              organization_id: profile.organization_id,
              name: baseOwner.name,
              phone: baseOwner.phone || null,
              email: baseOwner.email || null,
              document: baseOwner.document || null,
              notes: baseOwner.notes || null,
              is_primary: true,
            });
          }

          result.created++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({ rowIndex: i, message: err.message || 'Erro desconhecido' });
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties-list'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (result.failed === 0) {
        toast({ title: `${result.created} imóveis criados!`, description: 'Todos os imóveis foram criados com sucesso.' });
      } else {
        toast({
          title: `${result.created} criados, ${result.failed} com erro`,
          description: result.errors.map(e => `Linha ${e.rowIndex + 1}: ${e.message}`).join('; '),
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      const norm = normalizeError(error);
      toast({ title: 'Erro ao criar imóveis', description: norm.userMessage || norm.message, variant: 'destructive' });
    },
  });

  return {
    createBatch: mutation.mutateAsync,
    isCreating: mutation.isPending,
    validateRows,
  };
}

export function isRowEmpty(row: VariationRow): boolean {
  return (
    !row.property_code &&
    !row.unit_label &&
    row.bedrooms === null &&
    row.suites === null &&
    row.bathrooms === null &&
    row.parking_spots === null &&
    row.area_useful === null &&
    row.area_total === null &&
    row.sale_price === null &&
    !row.notes
  );
}

export function createEmptyRow(): VariationRow {
  return {
    id: crypto.randomUUID(),
    property_code: '',
    unit_label: '',
    bedrooms: null,
    suites: null,
    bathrooms: null,
    parking_spots: null,
    area_useful: null,
    area_total: null,
    sale_price: null,
    status: 'disponivel',
    notes: '',
  };
}

export function createRowFromBase(base: any): VariationRow {
  return {
    id: crypto.randomUUID(),
    property_code: '',
    unit_label: '',
    bedrooms: base.bedrooms ?? null,
    suites: base.suites ?? null,
    bathrooms: base.bathrooms ?? null,
    parking_spots: base.parking_spots ?? null,
    area_useful: base.area_useful ?? null,
    area_total: base.area_total ?? null,
    sale_price: base.sale_price ?? null,
    status: 'disponivel',
    notes: '',
  };
}
