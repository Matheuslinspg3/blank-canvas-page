

# Plan: Filtros na lista de imóveis v2 + corrigir "Ver Imóveis"

## Problemas identificados

1. **"Ver imóveis" não funciona**: O botão aponta para `#imoveis`, mas o `SectionRenderer` não coloca `id` nas seções. Nenhum elemento na página tem esse ID, então o scroll anchor não encontra destino.

2. **Sem filtros nos imóveis**: O `PropertyListElement` exibe apenas um grid estático. Os templates legados (Modern, Bold, Elegant, Minimal) todos usam `StorefrontFilters` com busca, tipo de transação, quartos, vagas, preço, cidade e bairro. O modo avançado v2 não tem isso.

## Solução

### A. Anchor IDs nas seções (SectionRenderer)

Adicionar `id={section.anchor || section.label?.toLowerCase().replace(/\s+/g, '-')}` no `<section>` do `SectionRenderer.tsx`. Isso permite que seções com label "Imóveis" gerem automaticamente `id="imoveis"`, fazendo os botões `#imoveis` funcionarem.

Também atualizar o converter (`convertLegacyToSiteLayoutV2.ts`) para adicionar `anchor: 'imoveis'` na seção de imóveis e `anchor: 'sobre'` / `anchor: 'contato'` nas seções correspondentes.

### B. Filtros no PropertyListElement

Integrar `useStorefrontFilters` dentro do `PropertyListElement` quando `isEditing` é `false`. No modo público (storefront), renderizar o componente `StorefrontFilters` acima do grid de imóveis, com busca por texto, tipo de transação, quartos, vagas, preço, cidade e bairro.

No modo de edição, manter os placeholders atuais sem filtros.

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/siteBuilder/v2/SectionRenderer.tsx` | Adicionar `id` com anchor/label |
| `src/components/siteBuilder/v2/elements/properties/PropertyList/PropertyListElement.tsx` | Integrar `StorefrontFilters` + `useStorefrontFilters` |
| `src/lib/convertLegacyToSiteLayoutV2.ts` | Adicionar `anchor` nas seções geradas |
| `src/types/siteBuilderV2.ts` | Adicionar campo opcional `anchor?: string` no tipo `Section` |

## Resultado esperado

- Botão "Ver imóveis" faz scroll até a seção de imóveis
- Grid de imóveis tem barra de filtros completa (busca, tipo, quartos, vagas, preço, cidade, bairro)
- Filtros funcionam em tempo real no storefront público
- Editor continua mostrando placeholders sem filtros

