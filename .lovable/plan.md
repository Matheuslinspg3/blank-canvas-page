

# Plano: Corrigir exibição de External Listings no Marketplace

## Problemas identificados

**Problema 1 — External listings ficam escondidos quando não há imóveis internos**
Na linha 201 do `Marketplace.tsx`, a seção de external listings (linha 214-227) está **dentro** do bloco `properties.length > 0`. Se nenhum imóvel interno do marketplace corresponder aos filtros, o bloco inteiro não renderiza — incluindo os externos.

**Problema 2 — Padrão assíncrono sem re-fetch**
O fluxo é assíncrono: a Edge Function retorna imediatamente os listings existentes no banco (provavelmente vazio na primeira busca), e o n8n faz o scraping e chama o callback depois. Mas o hook tem `staleTime: 5min` e `refetchOnWindowFocus: false`, então o frontend nunca re-busca para ver os dados inseridos pelo callback.

## Solução

### Etapa 1 — Reestruturar layout do Marketplace.tsx
Mover a seção de external listings para **fora** do bloco condicional `properties.length > 0`, garantindo que apareçam independentemente de haver imóveis internos.

### Etapa 2 — Adicionar refetch automático no hook
Alterar `useExternalListings` para usar `refetchInterval` quando a primeira resposta vier com `n8n_triggered: true` (indicando que o scraping está em andamento). Isso fará o frontend re-buscar a cada ~10 segundos até os dados aparecerem.

Mudanças no hook:
- Armazenar `n8n_triggered` da resposta
- Usar `refetchInterval: 10000` quando n8n foi triggado e listings ainda estão vazios
- Parar o polling quando listings chegarem ou após 60 segundos

### Etapa 3 — Exibir loading de portais externos mesmo sem imóveis internos
Mover o indicador `externalLoading` / spinner para fora do bloco condicional também.

## Arquivos alterados
- `src/pages/Marketplace.tsx` — reestruturar layout
- `src/hooks/useExternalListings.ts` — adicionar polling inteligente

