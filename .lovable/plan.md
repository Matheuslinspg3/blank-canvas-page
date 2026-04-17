

## Diagnóstico — Página /imoveis demora 2+ min

**Volume real (org Porto Caiçara):** 1.488 imóveis · 17.892 imagens.

### Causa principal — `usePropertyCRUD` baixa TUDO duas vezes
`src/hooks/usePropertyCRUD.ts` (l. 47-103) faz `SELECT` paginado (200 em 200) com `images:property_images!left(...)` embutido. Para 1.488 imóveis isso são **8 round-trips sequenciais** trazendo ~17.892 linhas de imagem com colunas grandes (`url`, `cached_thumbnail_url`, `r2_key_full`…). Resultado: payload gigantesco (vários MB), parse JSON lento e re-render em cascata.

### Causa secundária — duas queries pesadas em paralelo
`src/pages/Properties.tsx` (l. 89-97) dispara simultaneamente:
1. `useAdvancedPropertySearch` → RPC `search_properties_advanced` com `p_limit: 2000` (sempre, mesmo sem filtros).
2. `useProperties` → o fetch paginado acima.

Ambas concorrem pela mesma conexão Postgres + RLS, dobrando latência. `isLoading = isSearching || isLoadingAll` só libera a UI quando AMBAS terminam.

### Causas terciárias
- `idx_property_images_property_id` existe, mas o `!left` join hidrata todas as imagens só para mostrar a capa no card.
- Falta índice composto `(organization_id, created_at DESC)` para o `ORDER BY` do listing.
- `staleTime: 5min` no CRUD vs. `30s` no advanced search → cache desencontrado refaz fetch ao voltar à página.
- Sort/filter feito no cliente sobre 1.488 itens em `useMemo` — aceitável, mas fica preso atrás do fetch.

---

## Plano de correção

### 1. Hook leve para listagem (corrige causa principal)
Criar `usePropertiesList` que substitua `useProperties()` em `Properties.tsx`:
- Selecionar **apenas campos do card** (sem `description`, `payment_options`, `amenities`, etc.).
- Trocar `images:property_images!left(...)` por **subquery só da capa** ou coluna materializada `cover_image_url` já existente em vários fluxos.
- Paginar de verdade no servidor: `range(0, pageSize-1)` com `count: 'exact'` — nada de loop até esgotar.
- Manter `useProperties()` original só para mutations e PropertyDetails.

### 2. Eliminar dupla query (corrige causa secundária)
Em `Properties.tsx`:
- Tornar `useAdvancedPropertySearch` **condicional**: `enabled: hasActiveFilters`.
- Quando não há filtro, usar diretamente os dados do `usePropertiesList` paginado.
- Quando há filtro, **desabilitar** `usePropertiesList` (ou só usar como cache de detalhes) e renderizar resultados do RPC.

### 3. Índice de banco (migration)
```sql
CREATE INDEX IF NOT EXISTS idx_properties_org_created_desc
  ON public.properties (organization_id, created_at DESC);
```

### 4. Otimização preventiva
- Aumentar `staleTime` do advanced search para 2 min e alinhar com CRUD.
- Reduzir `p_limit` do RPC de 2000 → 200 (paginar via `p_offset`).
- Pré-carregar capas via `cached_thumbnail_url` (já existe) e parar de enviar `r2_key_full` para a listagem.
- Adicionar `select('id', { count: 'exact', head: true })` separado para mostrar total sem baixar linhas.

### Arquivos afetados
- `src/hooks/usePropertiesList.ts` (novo)
- `src/pages/Properties.tsx` (trocar hooks + tornar advanced search condicional)
- `src/hooks/useAdvancedPropertySearch.ts` (paginação + limit menor)
- `supabase/migrations/<novo>.sql` (índice composto)

### Resultado esperado
2 min → < 3 s no first load para a org de 1.488 imóveis.

