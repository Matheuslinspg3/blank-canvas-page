

# Plan: Corrigir botão vermelho, favicon, anchors e cores no storefront v2

## Problemas identificados (confirmados via browser)

1. **Botão "Ver Imóveis" vermelho**: O `ButtonElement` usa classes Tailwind (`bg-primary`) que resolvem para o primary padrão do Tailwind (vermelho/rosa), e NÃO para a cor da marca. O storefront define `--sf-primary` como CSS variable, mas o botão não a usa.

2. **Nenhum botão funciona / "Ver Imóveis" não faz scroll**: Todas as 6 seções na página têm `id=""` (vazio). O `SectionRenderer` gera IDs a partir de `section.anchor || section.name`, mas o layout gerado pela IA (`useSiteAIGeneration`) não define `anchor` nem `name` nas seções.

3. **Favicon do Porta do Corretor**: O `index.html` tem `<link rel="icon" href="/favicon.png">` hardcoded. O `SEOHead` injeta dinamicamente via Helmet, mas o favicon estático pode ser carregado antes ou tomar precedência em alguns browsers.

4. **Filtros**: JÁ FUNCIONAM — confirmado no browser. A barra de busca, tabs Todos/Venda/Aluguel e ícone de filtros estão presentes.

## Solução

### A. ButtonElement — usar cor da marca via CSS variable

No `ButtonElement.tsx`, trocar `bg-primary text-primary-foreground` por estilos inline que usam `var(--sf-primary)` com fallback para as classes Tailwind padrão (para não quebrar o editor).

Quando `isEditing` é `false` (storefront público), aplicar:
```
style={{ backgroundColor: 'var(--sf-primary, hsl(var(--primary)))' }}
```

Para o variant `secondary`, usar `var(--sf-secondary)`.

### B. Anchors nas seções geradas pela IA

No `useSiteAIGeneration.ts`, dentro de `buildLayoutFromAI`, detectar o `template_id` de cada seção e atribuir anchors automaticamente:
- Templates com "hero" → `anchor: 'hero'`
- Templates com "about" → `anchor: 'sobre'`
- Templates com "properties" → `anchor: 'imoveis'`
- Templates com "contact" ou "footer" → `anchor: 'contato'`

Também definir `name` para cada seção baseado no template.

### C. Favicon dinâmico para white-label

Remover o `<link rel="icon" href="/favicon.png">` do `index.html` (o `SEOHead` já injeta dinamicamente). Isso permite que o Helmet controle o favicon, que no caso do Porto Caiçara usará a `brand.logo_url`.

Se `brand.logo_url` for null, o SEOHead não injeta favicon, e o browser usará o fallback padrão.

### D. Re-publicação necessária

Após as correções de código, o site precisará ser republicado pelo builder para que as mudanças de anchor no layout sejam aplicadas. As correções de CSS/ButtonElement e favicon serão imediatas.

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/siteBuilder/v2/elements/basic/Button/ButtonElement.tsx` | Usar `var(--sf-primary)` para cores |
| `src/hooks/useSiteAIGeneration.ts` | Adicionar `anchor` e `name` nas seções |
| `index.html` | Remover favicon hardcoded |

## Resultado esperado

- Botão "Ver Imóveis" usa a cor dourada/accent da marca
- Clicar "Ver Imóveis" faz scroll até a seção de imóveis
- Favicon mostra a logo da imobiliária (não do Porta)
- Filtros continuam funcionando (já estão OK)

