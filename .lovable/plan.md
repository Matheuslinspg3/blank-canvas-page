

## Plano: Controles de visualização no Marketplace

### Objetivo
Substituir o botão "Carregar mais" por carregamento completo (até 100 imóveis por org) e adicionar controles de visualização: quantidade por organização (10, 25, 50, 100) e modo de exibição (grade/detalhado).

### Alterações

#### 1. `src/hooks/useMarketplace.ts`
- Remover sistema de paginação incremental (`page`, `loadMore`, `hasMore`)
- Carregar todos os imóveis de uma vez (limit 1000 — o máximo do Supabase) em vez de paginar 12 em 12
- Simplificar o hook para retornar apenas `properties`, `totalCount`, `isLoading`, `isFetching`

#### 2. `src/pages/Marketplace.tsx`
- Adicionar estados: `orgPageSize` (10|25|50|100, default 10) e `viewMode` ("grid"|"list")
- Adicionar barra de controles acima dos resultados com:
  - Toggle Grade/Lista (ícones LayoutGrid / List)
  - Select de quantidade por organização: 10, 25, 50, 100
- Remover o botão "Carregar mais"
- Passar `orgPageSize` e `viewMode` para `MarketplaceOrgSection`

#### 3. `src/components/marketplace/MarketplaceOrgSection.tsx`
- Receber props `initialCount` (quantidade visível) e `viewMode`
- Usar `initialCount` em vez do hardcoded `COLLAPSED_COUNT = 6`
- Botão "Ver todos" expande para mostrar todos os imóveis daquela org (sem limite)
- Quando `viewMode === "list"`, renderizar cards em layout de lista (1 coluna, formato compacto)

#### 4. `src/components/marketplace/MarketplacePropertyCard.tsx`
- Adicionar prop `viewMode` opcional
- Quando `viewMode === "list"`, usar layout horizontal (imagem à esquerda, info à direita) em vez do card vertical

### Layout dos controles
```text
[Grade|Lista]  [10 por imob. ▼]     1103 imóveis encontrados
```

### Sem alterações no banco de dados

