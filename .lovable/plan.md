

## Problema

Bairros, cidades e categorias aparecem duplicados nos filtros por causa de inconsistências nos dados salvos — diferenças de caixa ("Centro" vs "centro"), espaços extras ("Praia Grande " vs "Praia Grande"), e acentuação. O sistema agrupa por valor exato, então variações geram entradas separadas.

## Locais afetados

1. **DB Functions** `get_property_neighborhoods` e `get_property_cities` — agrupam por valor bruto sem normalização
2. **`usePropertyLocations.ts`** — usa `new Set()` sem normalizar caixa
3. **`useMarketplace.ts`** — `useMarketplaceFilterData` faz `.trim()` mas não normaliza caixa
4. **`useMarketplaceNeighborhoods.ts`** — mesmo problema
5. **Formulário de imóvel** (`LocationTab.tsx`) — salva valor digitado sem normalizar
6. **Import PDF** (`PdfImportDialog.tsx`) — salva sem normalizar

## Plano

### 1. Criar função SQL de normalização + trigger de escrita
- Função `normalize_location_text(text)`: aplica `TRIM`, `INITCAP` (primeira letra maiúscula de cada palavra)
- Trigger `BEFORE INSERT OR UPDATE` na tabela `properties` que normaliza automaticamente `address_neighborhood`, `address_city` e `address_state`
- Isso garante que dados futuros entrem sempre padronizados

### 2. Migration para corrigir dados existentes
- UPDATE em massa normalizando os campos existentes usando a mesma função `normalize_location_text`

### 3. Atualizar DB functions de filtro
- `get_property_neighborhoods`: agrupar por `TRIM(INITCAP(address_neighborhood))` para garantir dedup mesmo em dados legados
- `get_property_cities`: idem para `TRIM(INITCAP(address_city))`

### 4. Normalização client-side (defesa em profundidade)
- **`usePropertyLocations.ts`**: normalizar com `.trim()` e dedup case-insensitive
- **`useMarketplace.ts`**: normalizar com dedup case-insensitive no Map
- **`useMarketplaceNeighborhoods.ts`**: idem

### 5. Normalizar no formulário antes de salvar
- **`LocationTab.tsx`**: aplicar `onBlur` nos campos de bairro/cidade/estado para auto-capitalizar e trimmar

### Detalhes técnicos

**Função SQL:**
```sql
CREATE OR REPLACE FUNCTION normalize_location_text(val text)
RETURNS text AS $$
  SELECT INITCAP(TRIM(REGEXP_REPLACE(val, '\s+', ' ', 'g')))
$$ LANGUAGE sql IMMUTABLE;
```

**Trigger:**
```sql
CREATE FUNCTION normalize_property_location() RETURNS trigger AS $$
BEGIN
  NEW.address_neighborhood := normalize_location_text(NEW.address_neighborhood);
  NEW.address_city := normalize_location_text(NEW.address_city);
  NEW.address_state := normalize_location_text(NEW.address_state);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Arquivos a editar:**
- 1 migration SQL (função, trigger, update em massa, recreate das functions de filtro)
- `src/hooks/usePropertyLocations.ts`
- `src/hooks/useMarketplace.ts`
- `src/hooks/useMarketplaceNeighborhoods.ts`
- `src/components/properties/form/LocationTab.tsx`

