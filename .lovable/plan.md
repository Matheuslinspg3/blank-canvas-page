

## Problema Identificado

Na listagem de imóveis (`usePropertyCRUD.ts`, linha 84), o código filtra intencionalmente as imagens para manter **apenas a imagem de capa**:

```typescript
images: (p.images || []).filter((img: any) => img.is_cover).slice(0, 1),
```

Isso significa que na aba de imóveis, cada imóvel mostra no maximo 1 foto (a capa). Se nenhuma imagem tiver `is_cover = true`, mostra 0 fotos.

Na landing page, a RPC `get_public_property_by_slug` busca **todas** as imagens, por isso funciona corretamente.

## Análise

Esse filtro foi provavelmente adicionado como otimização para a listagem (grid/tabela), onde só a capa é exibida. Porém, quando o usuario abre os detalhes do imóvel a partir da listagem, provavelmente reutiliza esses dados em cache, resultando em apenas 1 imagem visível.

## Plano

### 1. Alterar a query de listagem para manter todas as imagens

**Arquivo**: `src/hooks/usePropertyCRUD.ts` (linha 82-85)

Remover o filtro que descarta imagens non-cover. Manter todas as imagens ordenadas por `display_order`, com a capa primeiro:

```typescript
const processed = (data as unknown as PropertyWithDetails[]).map(p => ({
  ...p,
  images: (p.images || []).sort((a: any, b: any) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.display_order || 0) - (b.display_order || 0);
  }),
}));
```

Isso garante que:
- A listagem em grid/tabela continua usando `images[0]` como capa
- A tela de detalhes terá acesso a todas as imagens do imóvel

