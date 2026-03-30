

## Plano: Agrupar imóveis por organização no Marketplace

### Objetivo
Exibir os imóveis do Marketplace organizados por imobiliária/corretor, mostrando inicialmente 5-10 imóveis de cada organização com um botão "Ver mais" para expandir.

### Como vai funcionar

1. **Seção por organização** — Em vez de uma grade plana, o Marketplace mostrará blocos separados por organização. Cada bloco terá:
   - Nome e logo da organização (cabeçalho)
   - Grid com 5-6 imóveis iniciais (colapsado)
   - Botão "Ver mais imóveis" que expande para mostrar todos os imóveis daquela org
   - Contagem total de imóveis da org

2. **Busca do nome/logo da organização** — O hook `useMarketplace` será atualizado para buscar dados da tabela `organizations` (name, logo_url) com base nos `organization_id` distintos retornados.

3. **Agrupamento no frontend** — Os imóveis serão agrupados por `organization_id` usando `useMemo`, criando seções visuais distintas.

### Alterações técnicas

**Arquivo: `src/hooks/useMarketplace.ts`**
- Adicionar query para buscar organizações distintas que possuem imóveis no marketplace (`organizations` table — `id`, `name`, `logo_url`, `slug`)
- Exportar novo hook ou dados adicionais: `organizationInfo`

**Arquivo: Novo componente `src/components/marketplace/MarketplaceOrgSection.tsx`**
- Componente que recebe org info + lista de propriedades
- Estado local `expanded` (default: false)
- Mostra 6 imóveis quando colapsado, todos quando expandido
- Cabeçalho com logo + nome da org + contagem
- Botão "Ver mais X imóveis" / "Ver menos"

**Arquivo: `src/pages/Marketplace.tsx`**
- Agrupar `properties` por `organization_id`
- Renderizar um `MarketplaceOrgSection` por grupo
- Manter filtros e busca existentes funcionando normalmente

### Layout visual

```text
┌─────────────────────────────────────────┐
│  [Logo] Imobiliária XYZ  (12 imóveis)  │
├─────────────────────────────────────────┤
│  [Card] [Card] [Card]                  │
│  [Card] [Card] [Card]                  │
│        [ Ver mais 6 imóveis ]          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [Logo] Corretor ABC  (3 imóveis)      │
├─────────────────────────────────────────┤
│  [Card] [Card] [Card]                  │
└─────────────────────────────────────────┘
```

### Observações
- Organizações com mais imóveis aparecem primeiro
- Nenhuma migração de banco necessária — usa tabelas existentes (`organizations`, `marketplace_properties_public`)
- Os build errors existentes (vite not found, TypeScript) são problemas de ambiente/dependências, não relacionados a esta feature

