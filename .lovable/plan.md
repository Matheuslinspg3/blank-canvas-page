# Corrigir "Missing queryFn" no Sentry (rota /marketplace)

## Causa raiz (confirmada por leitura de código)

`src/components/AppSidebar.tsx`, linhas 75–105, tem um helper `safePrefetch` que chama `queryClient.prefetchQuery({ queryKey, staleTime })` **sem `queryFn`**:

```ts
const safePrefetch = (...keys: unknown[][]) => {
  keys.forEach((queryKey) => {
    const existing = qc.getQueryState(queryKey);
    if (existing) {
      qc.prefetchQuery({ queryKey, staleTime: 60_000 }); // ❌
    }
  });
};
```

Isso é disparado em `onMouseEnter` dos itens do menu lateral (linha 157). No React Query v5, `prefetchQuery` **exige `queryFn` explícito a cada chamada** — não reaproveita a função de um observer anterior. Quando o usuário está em `/marketplace` (onde `useLeadCRUD`/`useAppointments` não estão montados) e passa o mouse sobre "CRM" ou "Agenda", o cache contém entradas `["leads", orgId]` / `["appointments", orgId]` (criadas por `invalidateQueries` de várias mutations) **sem `queryFn` registrada**, e o prefetch quebra com a exceção do Sentry.

Os hooks `useLeadCRUD` e `useAppointments` em si estão corretos.

## Correção

Remover por completo o `prefetchRoute` do `AppSidebar`. O ganho é praticamente nulo (só refresca entradas que já estavam em cache), e cada hook de destino (`useLeadCRUD`, `useAppointments`, `useTransactions`, etc.) já tem `staleTime` suficiente para uma navegação fluida.

### Alterações em `src/components/AppSidebar.tsx`

1. Linha 1–2: remover `useCallback` do import de React e remover o import `useQueryClient`:
   ```ts
   import React from "react";
   ```
2. Linhas 75–105: remover o bloco completo (`const qc = useQueryClient();` + `const prefetchRoute = useCallback(...)`).
3. Linha 157: remover o atributo `onMouseEnter={() => prefetchRoute(item.url)}` do `<NavLink>`.

Nenhum outro arquivo é afetado.

## Verificação

Varredura completa por `prefetchQuery`/`fetchQuery`/`ensureQueryData` no projeto retorna **só** `src/components/AppSidebar.tsx:85` como ofensor. As queries da superfície do `/marketplace` (`useMarketplace`, `useMarketplaceStatus`, `useMarketplaceNeighborhoods`, `useMarketplaceMetrics`, `useExternalListings`) têm `queryFn` corretas.

## Riscos

Nenhum funcional. UX permanece igual (a maioria das rotas já tem dados em cache válidos por 1–2 min via `staleTime`). Elimina-se a exceção de produção.