## Objetivo

Eliminar o `unhandledrejection` no Sentry causado pelo limite de imóveis na rota `/imoveis`, criar plano interno sem limites para organizações específicas (atribuível só por `developer`), e centralizar a lógica de limites em helpers reutilizáveis.

## Diagnóstico (já investigado)

- Mensagem origem: `src/hooks/usePropertyCRUD.ts` linha 144 — `throw new Error("Limite de ${limit} imóveis atingido…")` dentro da `mutationFn` de `createProperty`.
- `src/pages/Properties.tsx` chama `createProperty` via `mutateAsync` (linhas 366 e 599) sem `try/catch` que diferencie erro de produto, e o erro genérico vira `unhandledrejection` quando o componente desmonta antes do `onError`.
- Já existe `isExpectedBusinessError` em `src/lib/normalizeError.ts` que reconhece a string da mensagem (linha 41), mas não é checado no Sentry `beforeSend`.
- Tabela `subscription_plans` tem 25 planos, nenhum com `slug='internal_unlimited'`. Enum `app_role` já contém `developer`. Função `has_role(uuid, app_role)` existe.
- Convenção atual de limite (`useSubscription.normalizeLimit`): `-1` = Infinity, `null/undefined` = legacy unlimited, finito ≥ 0 = cap real.

## 1. Migration de banco (`supabase/migrations/20260501180000_internal_unlimited_plan.sql`)

Idempotente:

- `INSERT … ON CONFLICT (slug) DO UPDATE` cria o plano:
  - `slug='internal_unlimited'`, `name='Plano Interno Unlimited'`, `plan_type='plan'`, `is_active=true`, `display_order=9999`, `price_monthly=0`, `price_yearly=0`.
  - Limites: `max_own_properties=-1`, `max_shared_properties=-1`, `max_users=-1`, `max_leads=-1`.
  - `features` JSONB: `{ is_internal: true, is_public: false, is_purchasable: false, max_custom_domains: -1, max_marketplace_properties: -1, max_storage_mb: -1, ai_credits_limit: -1 }`.
- Função `is_org_on_internal_unlimited(_org_id uuid) RETURNS boolean` SECURITY DEFINER, STABLE — checa subscriptions com `status IN ('active','trial')`. Grant `EXECUTE` para `authenticated, anon`.
- Trigger `guard_internal_unlimited_assignment` (BEFORE INSERT/UPDATE em `subscriptions`):
  - Se `plan_id` apontar para slug `internal_unlimited` e `auth.uid()` não for `developer`, levanta `ERRCODE 42501` ("Only developers can assign the internal_unlimited plan").
  - Permite sem checagem quando `auth.uid() IS NULL` (service role / migrations).
  - Em UPDATE, se o plano antigo já era `internal_unlimited`, libera (não bloqueia updates não relacionados).

Sem alterar plano de organizações existentes. Sem mexer em RLS já existente.

## 2. Novo helper `src/lib/planLimits.ts`

- `isUnlimitedLimit(limit)` — `null | undefined | -1 | !Number.isFinite` → true.
- `hasReachedLimit(current, limit)` — false se ilimitado, senão `current >= limit`.
- `isOrgOnInternalUnlimited(plan)` — true se `plan.slug === 'internal_unlimited'`.
- `isInternalPlan(plan)` — true se slug interno OU `features.is_internal === true`.
- Classe `ProductLimitError extends Error` com:
  - `name = 'ProductLimitError'`, `code` (ex: `PROPERTY_LIMIT_REACHED`), `resource` (`'properties' | 'marketplace_properties' | 'leads' | 'users' | 'custom_domains' | …`), `limit`, `current?`.
  - Marcadores `isProductLimit = true` e `isExpected = true` para Sentry/normalize filtrar.
  - `Object.setPrototypeOf` para preservar `instanceof` após transpile.
- `isProductLimitError(err)` type guard (cobre cross-realm via duck typing).

## 3. Refatorar `src/hooks/usePropertyCRUD.ts`

No `createProperty.mutationFn`:

- Importar `isOrgOnInternalUnlimited`, `hasReachedLimit`, `ProductLimitError` de `@/lib/planLimits`.
- Substituir o `throw new Error(...)` por:
  ```ts
  if (isOrgOnInternalUnlimited(plan)) {
    // bypass — sem checagem
  } else if (hasReachedLimit(currentCount ?? 0, limit === Infinity ? -1 : limit)) {
    throw new ProductLimitError({
      code: 'PROPERTY_LIMIT_REACHED',
      resource: 'properties',
      limit,
      current: currentCount ?? 0,
      message: `Seu plano permite até ${limit} imóveis. Faça upgrade para adicionar mais.`,
    });
  }
  ```

No `onError`:

- Detectar `isProductLimitError(error)` ANTES de `normalizeError`.
- Mostrar toast controlado: `title: "Limite do plano atingido"`, `description: error.message`, `action`/`actionAltText`: "Ver upgrade" navegando para `/planos` (usar callback simples — `window.location.href` ou `useNavigate` se disponível no hook; aqui mantemos `toast` com action handler).
- NÃO relançar — React Query já não captura como crítico após `onError`.

## 4. Refatorar `src/hooks/usePropertyBulkOps.ts`

`assertMarketplaceLimit` lança `Error` genérico hoje. Trocar por `ProductLimitError({ code: 'MARKETPLACE_LIMIT_REACHED', resource: 'marketplace_properties', limit, current })`. Adicionar bypass via `isOrgOnInternalUnlimited` (precisa carregar slug do plano — já carrega `plan` na consulta atual).

## 5. Refatorar `src/pages/Properties.tsx`

- Linha 599 (`executePropertySubmit`): envolver `await createProperty(...)` em `try/catch`. Se `isProductLimitError(err)` → return silencioso (toast já foi exibido pelo `onError` do hook). Senão, re-throw para preservar comportamento atual.
- Linha 366 (`executeBatchImport`): já tem `catch{}` — ajustar para incrementar `errors` apenas se `!isProductLimitError(err)` (mantém o comportamento atual de contar como erro mas não polui Sentry).

## 6. Atualizar `src/lib/normalizeError.ts`

- `isExpectedBusinessError`: adicionar checagem `isProductLimitError(err)` no topo (retorna true).
- `normalizeError`: se entrada já é `ProductLimitError`, retornar como-is com `isExpected = true`.

## 7. Atualizar `src/main.tsx` Sentry `beforeSend`

- Antes do bloco de `isImportChunkError`, adicionar:
  ```ts
  if (isProductLimitError(err)) return null;  // não enviar
  ```
- Importar `isProductLimitError` de `@/lib/planLimits`.
- Adicional: incluir `"ProductLimitError"` em `ignoreErrors` para reforçar.

## 8. Atualizar `src/hooks/useSubscription.ts`

- Query `subscription-plans` (linha 161): filtrar planos internos da listagem pública. Adicionar `.not('features->>is_internal', 'eq', 'true')` ou filtrar no client (`safePlans = data.filter(p => !isInternalPlan(p))`). Usar filtro no client (mais robusto contra plano sem `features`).
- `mainPlans` / `addonPlans` / `marketplacePlans` etc derivam de `safePlans` — automaticamente excluem o interno.
- `getFeatureLimit(plan, key)`: adicionar early-return `if (isOrgOnInternalUnlimited(plan)) return Infinity;` no topo. Cobre todas as keys, inclusive `FAIL_CLOSED_KEYS` (para `internal_unlimited` o bypass é total e intencional).

## 9. Nova Edge Function `supabase/functions/admin-set-org-plan/index.ts`

- POST com body `{ organization_id: uuid, plan_slug: string }`.
- Validação:
  - JWT obrigatório (`auth.getUser()`); 401 se ausente/inválido.
  - `has_role(user_id, 'developer')` via RPC; 403 se falso.
  - Body validado com Zod.
- Ação: usa `SUPABASE_SERVICE_ROLE_KEY` para:
  - Buscar `plan_id` por slug.
  - `UPSERT` em `subscriptions` para `organization_id` (status='active', billing_cycle='monthly', provider='internal', period_start=now, period_end=now+100 anos para ilimitado).
- CORS conforme padrão do projeto.
- Resposta: `{ ok: true, plan: { slug, name } }`.
- Auditoria: insert em `audit_log` (se a tabela existir) — opcional, melhor-effort.

`config.toml`: adicionar `[functions.admin-set-org-plan] verify_jwt = false` (validação manual em código, padrão do projeto).

Frontend: NÃO criar UI de atribuição agora — só a função existe. Developers chamam via `supabase.functions.invoke('admin-set-org-plan', { body: {...} })` no DevTools ou via tela developer existente em iteração futura.

## 10. Excluir plano interno do checkout

- `src/pages/Plans.tsx` e qualquer tela pública que liste planos: como `useSubscription` já filtra `isInternalPlan`, o plano não aparece.
- Edge function `billing` (`create-subscription`): adicionar checagem — se `plan_slug === 'internal_unlimited'`, retornar 403. Implementar dentro do mesmo arquivo `index.ts`.

## 11. Testes

- `src/test/planLimits.test.ts` (já existe — estender):
  - `isUnlimitedLimit` casos: null, undefined, -1, 0, 5, Infinity.
  - `hasReachedLimit` casos: ilimitado nunca true; finito true em ≥.
  - `ProductLimitError` é `instanceof Error` e `isProductLimitError` retorna true.
  - `isOrgOnInternalUnlimited` reconhece slug.
  - `isInternalPlan` reconhece via slug e via features.

## Arquivos alterados

**Novo:**
- `supabase/migrations/20260501180000_internal_unlimited_plan.sql`
- `src/lib/planLimits.ts`
- `supabase/functions/admin-set-org-plan/index.ts`

**Editados:**
- `src/hooks/usePropertyCRUD.ts`
- `src/hooks/usePropertyBulkOps.ts`
- `src/pages/Properties.tsx`
- `src/lib/normalizeError.ts`
- `src/main.tsx`
- `src/hooks/useSubscription.ts`
- `supabase/functions/billing/index.ts` (bloqueio de checkout)
- `supabase/config.toml` (entry para `admin-set-org-plan`)
- `src/test/planLimits.test.ts`

## Critérios de aceite cobertos

1. Org comum no limite → toast controlado, sem `unhandledrejection`, sem Sentry crítico.
2. Org `internal_unlimited` → bypass total em `getFeatureLimit` + `isOrgOnInternalUnlimited` na mutation.
3. Não-developer tentando atribuir → 403 da edge function + bloqueio adicional via trigger DB.
4. Developer atribuindo → upsert em subscriptions, organização passa a usar plano interno.
5. Plano interno escondido: filtrado em `useSubscription`, bloqueado no checkout, não comprável.
6. Build/typecheck/test passam (executados pelo build automático).