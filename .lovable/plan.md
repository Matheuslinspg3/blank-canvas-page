# Fase 2 — Controle de Revisão de Imóveis

Implementação aprovada conforme escopo. Abaixo, o plano técnico final que vou executar quando o modo padrão estiver ativo.

## 1. Migration SQL (nova)

Arquivo: `supabase/migrations/<timestamp>_phase2_review_filter.sql`

- DROP da assinatura atual de `search_properties_advanced` (26 parâmetros, terminando em `p_owner_id`).
- CREATE da nova versão **mantendo todos os 26 parâmetros existentes na mesma ordem** e adicionando ao final:
  ```
  p_review_status text DEFAULT NULL
  ```
- Adicionar dentro do CTE `filtered`, antes do `LIMIT/OFFSET`:
  ```sql
  AND (
    p_review_status IS NULL OR p_review_status = 'all'
    OR (p_review_status = 'reviewed_30' AND p.last_reviewed_at >= now() - interval '30 days')
    OR (p_review_status = 'reviewed_60' AND p.last_reviewed_at >= now() - interval '60 days')
    OR (p_review_status = 'reviewed_90' AND p.last_reviewed_at >= now() - interval '90 days')
    OR (p_review_status = 'overdue_30' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '30 days'))
    OR (p_review_status = 'overdue_60' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '60 days'))
    OR (p_review_status = 'overdue_90' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '90 days'))
    OR (p_review_status = 'never'      AND p.last_reviewed_at IS NULL)
  )
  ```
- Manter:
  - retorno com `last_reviewed_at`;
  - filtro server-side por `p_owner_id` via `EXISTS`;
  - `total_count` calculado depois de todos os filtros;
  - ordenação atual;
  - `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`.
- `GRANT EXECUTE` para `authenticated`.

**Assinatura final esperada (resumida):**
```
search_properties_advanced(
  p_organization_id uuid,
  ... (todos os parâmetros existentes na ordem atual) ...,
  p_sort_by text DEFAULT 'recent',
  p_owner_id uuid DEFAULT NULL,
  p_review_status text DEFAULT NULL
)
```

## 2. `src/hooks/usePropertyFilters.ts`

- Adicionar campo `reviewStatus: string` na interface `PropertyFilters` (default `'all'`).
- Inicializar a partir da URL via `searchParams.get('revisao') || 'all'`.
- No `useEffect` de sincronização: `if (filters.reviewStatus !== 'all') params.set('revisao', filters.reviewStatus)`.
- Incluir em `defaultFilters`, `clearFilters`, `hasActiveFilters` e `activeFilterCount`.

## 3. `src/hooks/useAdvancedPropertySearch.ts`

- Adicionar `reviewStatus` na `queryKey` (já está implícito porque passa `filters` inteiro, mas confirmo manter o `filters` no key — ele serializa o novo campo automaticamente).
- Passar para a RPC:
  ```ts
  p_review_status: filters.reviewStatus && filters.reviewStatus !== 'all' ? filters.reviewStatus : null,
  ```

## 4. `src/components/properties/PropertyFilters.tsx`

- Adicionar nova seção “Revisão” (ícone `CalendarCheck` ou `History`) após o filtro “Proprietário”:
  - `Select` com options:
    - `all` — Todos
    - `reviewed_30` — Revisados há 30 dias ou menos
    - `reviewed_60` — Revisados há 60 dias ou menos
    - `reviewed_90` — Revisados há 90 dias ou menos
    - `overdue_30` — Sem revisão há +30 dias
    - `overdue_60` — Sem revisão há +60 dias
    - `overdue_90` — Sem revisão há +90 dias
    - `never` — Nunca revisados
- Adicionar badge ativo na barra de filtros visíveis quando `reviewStatus !== 'all'`.

## 5. `src/components/properties/PropertyReviewBadge.tsx`

Ajustar a função `classify` para a regra final da Fase 2 (mantendo nome, props e tooltip):
- `<= 30 dias` → verde (`fresh`)
- `31–60 dias` → amarelo (`warning`)
- `> 60 dias` → vermelho (`stale`)
- `null` → cinza/neutro (“Nunca revisado”) com leve tom de alerta

Labels mantidos: “Revisado hoje”, “Revisado há X dias”, “Nunca revisado”.

## 6. `src/components/owners/OwnerDetails.tsx` — refatoração

- Remover dependência do `getOwnerProperties` (JOIN simples) para a listagem rica.
- Construir um objeto `PropertyFilters` **local** (estado interno do Sheet, sem `useSearchParams`) com `defaultFilters` clonado + `ownerId: owner.id`.
- Estado local:
  - `searchText`
  - `status` (default `all`)
  - `reviewStatus` (subset: `all`, `overdue_30`, `overdue_60`, `never`)
  - `page` (default 1, `pageSize = 20`)
- Chamar `useAdvancedPropertySearch(localFilters, !!owner && open, { page, pageSize: 20 })`.
- Para evitar acoplamento, exportar `defaultFilters` de `usePropertyFilters.ts` via `export const defaultFilters` (se ainda não está exportado) **ou** criar helper `createDefaultPropertyFilters()` exportado.
- Mini-toolbar dentro do Sheet:
  - `Input` busca por título/código (debounce simples 300ms);
  - `Select` status (Todos / Disponível / Reservado / Vendido / Alugado / Inativo);
  - `Select` revisão (Todos / +30d / +60d / Nunca);
- Listagem usando um novo componente compacto (ver item 7).
- Paginação: botões “Anterior / Próxima” + contador `X de Y`.

## 7. Novo componente: `src/components/owners/OwnerPropertyListItem.tsx`

Decisão: **criar componente compacto dedicado**, pois `PropertyListItem` é muito largo para o Sheet (ações de marketplace, change-status submenu, share, duplicar, etc., que poluiriam a tela do proprietário).

Conteúdo:
- Linha compacta com:
  - thumb 40×40 (cover);
  - título + `property_code` (badge);
  - cidade/bairro;
  - `PropertyStatusBadge`;
  - `PropertyReviewBadge` (não-compact, mostra os dias);
  - menu `MoreHorizontal` com:
    - “Ver imóvel” → `navigate(/imoveis/:id)` (fecha Sheet);
    - “Editar” → fecha Sheet e dispara navegação para a tela de edição (ou callback opcional);
    - “Marcar como revisado” → `usePropertyReview().mutate(id)`.
- Reusa `PropertyReviewBadge` e `usePropertyReview` (sem duplicar regra).

## 8. Multi-tenant e segurança

- A RPC continua `SECURITY DEFINER` filtrando por `p_organization_id` igual ao da org do usuário (já vem via `profile.organization_id`).
- `p_owner_id` cruza com `property_owners` exigindo `organization_id = p_organization_id`, garantindo que owners de outra org não retornem nada.
- Nenhuma chamada client-side recebe owner cross-tenant porque `useOwners` já filtra por `organization_id`.

## 9. Query invalidation

- `usePropertyReview` (Fase 1) já invalida `properties-advanced-search`, `properties-list`, `property-detail`, etc. — funciona automaticamente para a tela do proprietário, pois a listagem usa `useAdvancedPropertySearch`.

## 10. Validação final

- `npx tsc --noEmit`
- `npx vite build`
- Corrigir qualquer erro antes de finalizar.

## Fora de escopo (Fase 3)

- Dashboard de imóveis desatualizados;
- Configuração de prazo por organização;
- Alertas / notificações / automações;
- Relatórios / SLA configurável.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebrar chamadas existentes da RPC | Manter ordem dos 26 parâmetros e adicionar `p_review_status` apenas no fim com DEFAULT NULL |
| `defaultFilters` não exportado | Exportar formalmente em `usePropertyFilters.ts` |
| URL do proprietário poluída pela tela de imóveis | Filtros do `OwnerDetails` ficam em estado local, sem `useSearchParams` |
| `PropertyListItem` quebrar dentro do Sheet | Criar `OwnerPropertyListItem` compacto, reaproveitando badge + hook de revisão |
| Cache stale ao trocar de proprietário | `useAdvancedPropertySearch` já inclui `filters` (com `ownerId`) na queryKey |

## Entregáveis

Ao final farei um resumo técnico com migration, assinatura final da RPC, arquivos alterados, componentes criados, fluxo dos filtros, fluxo da integração com proprietários, instruções de teste e resultado de typecheck/build.
