

## Problema: Imagens não carregam no Marketplace

### Diagnóstico

Os dados estão corretos — 898 imóveis possuem URLs R2 válidas. O problema está na renderização do componente `OptimizedImage` dentro do `MarketplacePropertyCard`.

**Causa raiz:** O card cria um wrapper `<div className="relative aspect-[16/10]">` E também passa `aspectRatio="16/10"` para o `OptimizedImage`, que cria **outro wrapper interno** com aspect ratio. Essa dupla camada, combinada com o sistema de `opacity-0` → `opacity-100` do componente, faz com que imagens que demoram a carregar (ou cujo evento `onLoad` não dispara corretamente) fiquem permanentemente invisíveis.

Além disso, o `className` com efeito hover é **ignorado** quando `aspectRatio` está definido (by design no componente), então a prop está sendo desperdiçada.

### Solução

**Arquivo: `src/components/marketplace/MarketplacePropertyCard.tsx`**

Remover a prop `aspectRatio` do `OptimizedImage` já que o wrapper pai já define o aspect ratio. Usar a imagem como elemento simples com classes diretas, eliminando a dupla camada problemática:

```tsx
// ANTES (dupla camada + opacity bug):
<OptimizedImage
  src={proxyDriveImageUrl(property.images[0])}
  alt={property.title}
  aspectRatio="16/10"
  wrapperClassName="w-full h-full"
  className="group-hover:scale-[1.03] ..."
/>

// DEPOIS (imagem direta dentro do wrapper existente):
<OptimizedImage
  src={proxyDriveImageUrl(property.images[0])}
  alt={property.title}
  className="w-full h-full object-cover group-hover:scale-[1.03] ..."
/>
```

Sem `aspectRatio`, o `OptimizedImage` retorna apenas o `<img>` sem wrapper adicional, usando o div pai existente para posicionamento. O `className` é aplicado diretamente e o sistema de opacity funciona corretamente.

**Arquivo: `src/components/ui/optimized-image.tsx`**

Adicionar um fallback de segurança: se após 3 segundos o `onLoad` não disparou, forçar `opacity-100` para garantir que a imagem apareça mesmo em condições adversas (mobile lento, prefetch cache, etc).

### Impacto
- Nenhuma alteração no banco de dados
- Fix apenas no frontend (2 arquivos)
- Imagens R2 passam a renderizar corretamente no Marketplace

