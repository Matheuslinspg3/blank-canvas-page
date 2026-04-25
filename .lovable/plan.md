# Fase 1 — Controle de Revisão de Imóveis (Plano Final)

Escopo restrito: somente Fase 1. Sem dashboard, sem configuração por organização, sem filtros 30/60/90, sem alertas, sem automações.

---

## 1. Migrations (uma migration única e idempotente)

### 1.1 Coluna `last_reviewed_at`
```sql
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz NULL;

ALTER TABLE public.properties
  ALTER COLUMN last_reviewed_at SET DEFAULT now();
```
- Imóveis novos nascem como "revisados hoje" via DEFAULT.
- Imóveis antigos permanecem NULL → tratados como **"Nunca revisado"** na UI.
- Mudança puramente aditiva, sem backfill destrutivo.

### 1.2 Trigger comercial em `properties`
Lista **explícita** de campos comerciais. Tudo fora dela (incluindo `updated_at`, `last_reviewed_at`, contadores, cache, metadados) **não** dispara revisão.

Campos considerados comerciais:
`title, description, status, transaction_type, property_type_id, sale_price, sale_price_financed, rent_price, condominium_fee, iptu, bedrooms, bathrooms, suites, parking_spots, area_total, area_useful, area_built, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip_code, latitude, longitude, amenities, property_condition, launch_stage, development_name, beach_distance_meters, featured, availability_status`

```sql
CREATE OR REPLACE FUNCTION public.tg_properties_auto_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass para jobs técnicos
  IF current_setting('app.skip_review_touch', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Se a própria atualização já está mexendo em last_reviewed_at, não interferir
  -- (ex: RPC mark_property_reviewed faz UPDATE SET last_reviewed_at = now())
  IF NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at THEN
    RETURN NEW;
  END IF;

  IF (NEW.title IS DISTINCT FROM OLD.title)
     OR (NEW.description IS DISTINCT FROM OLD.description)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.transaction_type IS DISTINCT FROM OLD.transaction_type)
     OR (NEW.property_type_id IS DISTINCT FROM OLD.property_type_id)
     OR (NEW.sale_price IS DISTINCT FROM OLD.sale_price)
     OR (NEW.sale_price_financed IS DISTINCT FROM OLD.sale_price_financed)
     OR (NEW.rent_price IS DISTINCT FROM OLD.rent_price)
     OR (NEW.condominium_fee IS DISTINCT FROM OLD.condominium_fee)
     OR (NEW.iptu IS DISTINCT FROM OLD.iptu)
     OR (NEW.bedrooms IS DISTINCT FROM OLD.bedrooms)
     OR (NEW.bathrooms IS DISTINCT FROM OLD.bathrooms)
     OR (NEW.suites IS DISTINCT FROM OLD.suites)
     OR (NEW.parking_spots IS DISTINCT FROM OLD.parking_spots)
     OR (NEW.area_total IS DISTINCT FROM OLD.area_total)
     OR (NEW.area_useful IS DISTINCT FROM OLD.area_useful)
     OR (NEW.area_built IS DISTINCT FROM OLD.area_built)
     OR (NEW.address_street IS DISTINCT FROM OLD.address_street)
     OR (NEW.address_number IS DISTINCT FROM OLD.address_number)
     OR (NEW.address_complement IS DISTINCT FROM OLD.address_complement)
     OR (NEW.address_neighborhood IS DISTINCT FROM OLD.address_neighborhood)
     OR (NEW.address_city IS DISTINCT FROM OLD.address_city)
     OR (NEW.address_state IS DISTINCT FROM OLD.address_state)
     OR (NEW.address_zip_code IS DISTINCT FROM OLD.address_zip_code)
     OR (NEW.latitude IS DISTINCT FROM OLD.latitude)
     OR (NEW.longitude IS DISTINCT FROM OLD.longitude)
     OR (NEW.amenities IS DISTINCT FROM OLD.amenities)
     OR (NEW.property_condition IS DISTINCT FROM OLD.property_condition)
     OR (NEW.launch_stage IS DISTINCT FROM OLD.launch_stage)
     OR (NEW.development_name IS DISTINCT FROM OLD.development_name)
     OR (NEW.beach_distance_meters IS DISTINCT FROM OLD.beach_distance_meters)
     OR (NEW.featured IS DISTINCT FROM OLD.featured)
     OR (NEW.availability_status IS DISTINCT FROM OLD.availability_status)
  THEN
    NEW.last_reviewed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_auto_review ON public.properties;
CREATE TRIGGER trg_properties_auto_review
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_properties_auto_review();
```
A migration valida cada coluna antes de criar a função; se algum campo tiver sido renomeado, a criação falha cedo (proteção contra deploy sujo).

### 1.3 Trigger em `property_images`
Cobre INSERT (foto adicionada), DELETE (foto removida) e UPDATE de `is_cover` / `display_order` (capa trocada / reordenação). Updates de campos técnicos (`r2_key*`, `cache_status`, `cached_thumbnail_url`, etc.) **não** disparam revisão.

```sql
CREATE OR REPLACE FUNCTION public.tg_property_images_auto_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_should_touch boolean := false;
BEGIN
  IF current_setting('app.skip_review_touch', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    v_property_id := NEW.property_id;
    v_should_touch := true;
  ELSIF (TG_OP = 'DELETE') THEN
    v_property_id := OLD.property_id;
    v_should_touch := true;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_property_id := NEW.property_id;
    IF (NEW.is_cover IS DISTINCT FROM OLD.is_cover)
       OR (NEW.display_order IS DISTINCT FROM OLD.display_order) THEN
      v_should_touch := true;
    END IF;
  END IF;

  IF v_should_touch AND v_property_id IS NOT NULL THEN
    UPDATE public.properties
       SET last_reviewed_at = now()
     WHERE id = v_property_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_property_images_auto_review ON public.property_images;
CREATE TRIGGER trg_property_images_auto_review
  AFTER INSERT OR UPDATE OR DELETE ON public.property_images
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_property_images_auto_review();
```
O trigger comercial de `properties` detecta `NEW.last_reviewed_at IS DISTINCT FROM OLD` e sai limpo, evitando recursão lógica.

### 1.4 RPC `mark_property_reviewed`
```sql
CREATE OR REPLACE FUNCTION public.mark_property_reviewed(p_property_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user_org uuid;
  v_now timestamptz;
BEGIN
  v_user_org := public.get_user_organization_id();
  IF v_user_org IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.properties
   WHERE id = p_property_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_org <> v_user_org THEN
    RAISE EXCEPTION 'Forbidden: cross-tenant access';
  END IF;

  UPDATE public.properties
     SET last_reviewed_at = now()
   WHERE id = p_property_id
   RETURNING last_reviewed_at INTO v_now;

  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_property_reviewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_property_reviewed(uuid) TO authenticated;
```

### 1.5 RPC `search_properties_advanced` — recriar com cuidado
**Assinatura atual no banco** (verificada via `pg_proc`): existem **DUAS sobrecargas**:
- 24 args (sem `p_sort_by`)
- 25 args (com `p_sort_by`) ← usada hoje pelo frontend

**Plano**: dropar AS DUAS sobrecargas e recriar UMA assinatura única, com 27 parâmetros (adiciona `p_owner_id` e mantém `p_sort_by`).

```sql
DROP FUNCTION IF EXISTS public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[]
);
DROP FUNCTION IF EXISTS public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text
);

CREATE OR REPLACE FUNCTION public.search_properties_advanced(
  p_organization_id uuid,
  p_search_text text,
  p_property_code text,
  p_transaction_type text,
  p_status text,
  p_property_type_id uuid,
  p_min_price numeric,
  p_max_price numeric,
  p_min_bedrooms integer,
  p_neighborhood text,
  p_city text,
  p_min_area numeric,
  p_limit integer,
  p_offset integer,
  p_min_suites integer,
  p_min_parking integer,
  p_max_area numeric,
  p_min_condominium numeric,
  p_max_condominium numeric,
  p_amenities text[],
  p_property_condition text,
  p_max_beach_distance integer,
  p_launch_stage text,
  p_neighborhoods text[],
  p_cities text[],
  p_sort_by text DEFAULT 'recent',
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  -- ... mesmas colunas que retorna hoje ...
  last_reviewed_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
... corpo preservando todos os filtros, ordenação, paginação e total_count via window function ...
$$;
```

**Filtro do owner — server-side, antes de LIMIT/OFFSET**:
```sql
AND (
  p_owner_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.property_owners po
     WHERE po.property_id = p.id
       AND po.owner_id = p_owner_id
       AND po.organization_id = p_organization_id
  )
)
```

Inclusões na cláusula SELECT: `p.last_reviewed_at`.

**Compatibilidade**: como `p_owner_id` tem DEFAULT NULL e é o último parâmetro, e o frontend chama via named-args (`supabase.rpc(..., { p_organization_id, ... })`), todas as chamadas atuais continuam funcionando sem modificação obrigatória.

### 1.6 `app.skip_review_touch` — bypass para jobs técnicos
Edge functions auditadas que tocam `property_images`:
- `cache-drive-image` — UPDATE em `cache_status` / `cached_thumbnail_url` → técnico, **não dispara** o trigger (não mexe em `is_cover`/`display_order`).
- `migrate-to-r2` / `migrate-cloudinary-to-r2` — UPDATE de `r2_key*` → técnico, **não dispara**.
- `whatsapp-property-images` / `whatsapp-send-property-photos` → leitura/marcação, **não dispara**.
- `scrape-drive-photos` — DELETE+INSERT de fotos → **dispara** revisão (comportamento desejado: sincronizar fotos é revisão real).

Conclusão: nesta fase **nenhum job atual precisa setar `app.skip_review_touch='on'`**, porque o trigger de imagens já é seletivo. O bypass fica disponível para usos futuros.

**Ponto de atenção** documentado no resumo final: qualquer rotina futura que precisar mexer em `is_cover`/`display_order` por motivo puramente técnico (ex.: regenerar capa automaticamente após otimização) **deve** abrir transação com `SET LOCAL app.skip_review_touch = 'on'`.

---

## 2. Frontend

### 2.1 Hook novo: `src/hooks/usePropertyReview.ts`
```typescript
export function usePropertyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { data, error } = await supabase.rpc('mark_property_reviewed', { p_property_id: propertyId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties-list'] });
      qc.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['owner-property-ids'] });
      toast.success('Imóvel marcado como revisado');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao marcar como revisado'),
  });
}
```
Query keys reais confirmadas no projeto via grep: `properties-list`, `properties-advanced-search`, `properties`, `owner-property-ids`.

### 2.2 Componente novo: `src/components/properties/PropertyReviewBadge.tsx`
- Props: `lastReviewedAt: string | null`, `compact?: boolean`.
- Texto:
  - `null` → "Nunca revisado"
  - 0 dias → "Revisado hoje"
  - >0 dias → "Revisado há X dias"
- Cor por urgência: verde (≤7d), amarelo (8–30d), laranja (31–60d), vermelho (>60d / null).
- **Não substitui** `PropertyFreshnessBadge` (continua existindo, baseado em `updated_at`).

### 2.3 `src/hooks/useAdvancedPropertySearch.ts` (alteração)
- Acrescentar `p_owner_id: filters.ownerId ?? null` na chamada `supabase.rpc(...)`.
- Adicionar `last_reviewed_at: string | null` à interface `SearchResult`.
- `queryKey` permanece `['properties-advanced-search', orgId, filters, page, pageSize, sortBy]` (ownerId já está dentro de `filters`, garantindo isolamento de cache).

### 2.4 `src/hooks/usePropertiesList.ts` (alteração)
- Adicionar `last_reviewed_at` em `CARD_FIELDS`.
- Aceitar `ownerId?: string` em `PropertiesListOptions` como **fallback robusto** (caminho principal continua sendo a RPC quando há filtros ativos):
  - Se `ownerId` definido: pré-busca `property_id`s em `property_owners` paginando se necessário (`>1000`); aplica `.in('id', ids)`. Lista vazia retorna `{ rows: [], total: 0 }` sem erro.
- `queryKey` inclui `ownerId` para isolar cache: `['properties-list', orgId, page, pageSize, sortBy, ownerId ?? null]`.

### 2.5 `src/pages/Properties.tsx` (alteração)
- **Remover** o `useQuery` `'owner-property-ids'` e a filtragem client-side por `ownerPropertyIds`.
- Quando `filters.ownerId` está setado, ativar `hasActiveFilters = true` para usar a RPC (que agora filtra por owner server-side, antes da paginação).
- Mapear `last_reviewed_at` no objeto `allProperties` derivado de `searchResults`.

### 2.6 `src/components/properties/PropertyListItem.tsx` (alteração)
- Renderizar `<PropertyReviewBadge lastReviewedAt={property.last_reviewed_at} compact />` ao lado do `PropertyFreshnessBadge`.
- Adicionar item no `DropdownMenu`: **"Marcar como revisado"** (ícone `CheckCircle2`), chama `usePropertyReview().mutate(property.id)`.

### 2.7 `src/components/properties/PropertyCard.tsx` (alteração)
- Mesmo: badge + ação "Marcar como revisado" no menu.

### 2.8 `src/hooks/usePropertyCRUD.ts` (alteração mínima)
- Adicionar `last_reviewed_at: string | null` ao tipo `PropertyWithDetails`.
- Incluir `last_reviewed_at` no SELECT principal.

---

## 3. Tipos Supabase
`src/integrations/supabase/types.ts` é regenerado automaticamente pelo Lovable após a migration. Não editar manualmente.

---

## 4. UX — nomenclatura única
- "Última revisão"
- "Revisado hoje"
- "Revisado há X dias"
- "Nunca revisado"
- "Marcar como revisado"

Nunca usar "última atualização" para `last_reviewed_at`.

---

## 5. Como testar

**Criação**
1. Criar imóvel novo → badge "Revisado hoje".

**Edição comercial**
2. Editar preço/descrição/status → badge volta para "Revisado hoje".
3. Atualização puramente técnica não muda o badge (o trigger só reage à lista comercial).

**Fotos**
4. Adicionar foto → badge atualiza.
5. Remover foto → badge atualiza.
6. Trocar capa (`is_cover`) → badge atualiza.
7. Reordenar (`display_order`) → badge atualiza.
8. Job R2 escrevendo `r2_key_thumb` → badge **não** muda.

**Ação manual**
9. Imóvel antigo (`last_reviewed_at` NULL) → badge "Nunca revisado". Clicar "Marcar como revisado" → vira "Revisado hoje" e listagem atualiza sem refresh manual.

**Filtro por proprietário (bug corrigido)**
10. Selecionar proprietário com 60+ imóveis → todos aparecem (paginação correta), não só os da primeira página de 50.
11. Combinar owner + cidade + tipo → interseção real (server-side).
12. Selecionar proprietário sem imóveis → lista vazia, sem erro.

**Multi-tenant**
13. Logado na org A, chamar `mark_property_reviewed` com id de imóvel da org B → erro `Forbidden: cross-tenant access`.
14. Buscar com `p_owner_id` de outra org → 0 resultados (filtro `po.organization_id = p_organization_id`).

---

## 6. Resumo final entregue após implementação
- migration SQL única (aditiva, idempotente);
- assinatura final de `search_properties_advanced` (27 params, último = `p_owner_id uuid DEFAULT NULL`);
- arquivos alterados/criados (lista acima);
- mapa de onde `last_reviewed_at` muda: DEFAULT na criação, trigger comercial em edição, trigger de fotos, RPC manual;
- correção do filtro de owner: server-side via EXISTS na RPC + fallback paginado em `usePropertiesList`;
- ponto de atenção documentado: rotinas futuras que mexerem em `is_cover`/`display_order` por motivo técnico devem usar `SET LOCAL app.skip_review_touch='on'`.

**Fora de escopo** (não será implementado nesta fase): dashboard, configuração de prazo por organização, filtros 30/60/90, tela de proprietários com lista de imóveis, alertas, automações.