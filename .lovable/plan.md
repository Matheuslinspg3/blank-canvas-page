

## Diagnóstico — `properties_org_property_code_key` (23505)

### Causa raiz (confirmada — 99%)

**Race condition na geração de `property_code` no trigger PostgreSQL.**

O trigger `auto_generate_property_code` (migration `20260219142609`) faz:
```sql
SELECT COALESCE(MAX(property_code::int), 0) + 1
INTO v_next
FROM properties WHERE organization_id = NEW.organization_id;
NEW.property_code := v_next::text;
```
Sem `FOR UPDATE`, sem advisory lock, sem `SERIALIZABLE`. Quando dois INSERTs concorrentes da mesma org chegam (caso clássico: **react-query `mutations.retry: 1` em `App.tsx:114`**), ambos leem `MAX = N`, ambos calculam `N+1`, o primeiro vence, o segundo bate na constraint única → **23505**.

**Por que houve `POST 201` seguido de `POST 409`:**
1. Usuário clica "Cadastrar"
2. Mutation faz POST → 201 (sucesso)
3. Resposta demora a chegar OU houve um soft-error transitório
4. **react-query retry automático** (`retry: 1`) dispara segundo POST
5. Segundo POST tenta reusar o mesmo seq → 409 contra constraint
6. Front mostra erro, usuário acha que "não salvou" — mas salvou na 1ª tentativa

### Problemas secundários

| # | Problema | Arquivo |
|---|----------|---------|
| S1 | `mutations.retry: 1` global = retry cego em **todos** os inserts | `src/App.tsx:114` |
| S2 | `Sentry.captureException(error)` recebe objeto cru `{code,details,hint,message}` do PostgREST → "Object captured as exception with keys" | `src/App.tsx:117,138`; `usePropertyCRUD.ts:149` |
| S3 | `onError` do mutation só faz `toast({ description: error.message })` — não traduz `23505` em mensagem amigável | `usePropertyCRUD.ts:195-197` |
| S4 | Trigger SQL vulnerável a concorrência (causa raiz do banco) | `auto_generate_property_code` |
| S5 | Sem dedup de submit no `PropertyForm`: `disabled={isSubmitting}` depende de `isCreating` global do hook — se Dialog fechar antes (`onOpenChange(false)` na linha 290 acontece **depois** do await mas antes do `onSuccess`), ainda há janela mínima | `PropertyForm.tsx:267-291` |
| S6 | `MutationCache.onError` duplica o `Sentry.captureException` que já vem de `mutations.onError` → dois eventos por erro | `App.tsx:116-118` + `133-140` |

---

## Plano de implementação

### 1. Banco — corrigir trigger (causa raiz)

Nova migration:
```sql
CREATE OR REPLACE FUNCTION public.auto_generate_property_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next INT; v_attempts INT := 0;
BEGIN
  IF NEW.property_code IS NOT NULL THEN RETURN NEW; END IF;

  -- Advisory lock por organization_id: serializa geração apenas dentro da mesma org
  PERFORM pg_advisory_xact_lock(
    hashtext('property_code_gen'),
    hashtext(NEW.organization_id::text)
  );

  -- Loop defensivo (até 5 tentativas) caso constraint ainda colida por motivo externo
  LOOP
    SELECT COALESCE(MAX(property_code::int), 0) + 1
      INTO v_next
      FROM properties
     WHERE organization_id = NEW.organization_id
       AND property_code ~ '^\d+$';

    NEW.property_code := v_next::text;

    -- Verifica se o code está livre (defesa em profundidade)
    IF NOT EXISTS (
      SELECT 1 FROM properties
       WHERE organization_id = NEW.organization_id
         AND property_code = NEW.property_code
    ) THEN
      RETURN NEW;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Não foi possível gerar property_code único após 5 tentativas';
    END IF;
  END LOOP;
END; $$;
```
Advisory lock transacional libera no commit/rollback. Performance OK porque só serializa dentro da mesma `organization_id`.

### 2. Novo helper `src/lib/normalizeError.ts`

```ts
export interface NormalizedError extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
  isExpected?: boolean;
  userMessage?: string;
  constraint?: string;
}

export function normalizeError(raw: unknown): NormalizedError;
// - se já é Error → retorna
// - se { code, message, ... } (Postgres/PostgREST) → cria new Error(message) e
//   anexa code/details/hint/constraint
// - mapeia 23505 → userMessage amigável conforme constraint
// - name = 'PostgrestError' | 'AppError'

export function isUniqueViolation(err: unknown): boolean;  // code === '23505'
export function isExpectedBusinessError(err: unknown): boolean;
```

### 3. Atualizar `App.tsx` — react-query

```ts
mutations: {
  retry: false,            // ← NUNCA retryar mutations cegamente
  // (remover retryDelay; remover onError daqui — fica só no MutationCache)
},
mutationCache: new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    const norm = normalizeError(error);
    if (isExpectedBusinessError(norm)) return;   // não polui Sentry
    if (norm.message?.includes('AbortError')) return;
    Sentry.captureException(norm, {
      tags: {
        source: 'react-query-mutation',
        mutation_key: JSON.stringify(mutation.options.mutationKey ?? []).slice(0, 100),
        pg_code: norm.code,
        pg_constraint: norm.constraint,
      },
      extra: { details: norm.details, hint: norm.hint },
    });
  },
}),
```
Remover o `mutations.onError` duplicado.

### 4. `usePropertyCRUD.ts` — tratar 23505 no `createProperty`

```ts
mutationKey: ['properties', 'create'],
mutationFn: async (...) => {
  // ... insert ...
  if (error) throw normalizeError(error);
  // ...
},
onError: (error) => {
  const norm = normalizeError(error);
  if (norm.code === '23505' && norm.constraint === 'properties_org_property_code_key') {
    toast({
      title: 'Conflito ao gerar código',
      description: 'O código do imóvel colidiu com outro recente. Tente salvar novamente — geramos um novo código automaticamente.',
      variant: 'destructive',
    });
  } else {
    toast({ title: 'Erro ao cadastrar imóvel', description: norm.userMessage || norm.message, variant: 'destructive' });
  }
},
```
**Não** fazer retry automático aqui (regra do prompt: sem retry cego). Mas como o trigger agora usa advisory lock, a colisão praticamente desaparece. O toast orienta retry manual.

### 5. `PropertyForm.tsx` — guard rails de submit

- Adicionar `submittingRef = useRef(false)` no componente
- No `handleSubmit`: se `submittingRef.current` → `return` cedo
- `submittingRef.current = true` antes do await; `false` no `finally`
- Mover `onOpenChange(false)` para dentro de um `try/catch` — só fechar dialog em sucesso (hoje fecha mesmo após erro porque `await onSubmit(...)` lança e o `onOpenChange(false)` na linha 290 não roda — ok, mas sem proteção explícita o usuário pode reabrir e re-submetter os mesmos dados → outro 409). Adicionar `try { await onSubmit(...); onOpenChange(false); } catch { /* mantém aberto */ } finally { submittingRef.current = false }`
- Botão `<Button type="submit" disabled={isSubmitting || submittingRef.current}>` (já tem `isSubmitting`, reforçamos)

### 6. `Properties.tsx` — sucesso parcial

No `executePropertySubmit`, capturar erro do create separadamente e **não** chamar `publishToMarketplace` se o create falhou. Já está assim implicitamente (await throws), mas adicionar log claro.

---

## Arquivos alterados

**Novo:**
- `src/lib/normalizeError.ts`
- `supabase/migrations/<timestamp>_fix_property_code_race.sql`

**Modificados:**
- `src/App.tsx` (retry: false em mutations, dedup Sentry, normalize)
- `src/hooks/usePropertyCRUD.ts` (mutationKey, normalize no throw, onError com mensagem 23505)
- `src/components/properties/PropertyForm.tsx` (submittingRef + try/catch + onOpenChange só em sucesso)
- `src/lib/sentry.ts` (opcional: usar normalizeError no `captureError`)

---

## Guard rails entregues

| Guard | Mecanismo |
|-------|-----------|
| Anti race-condition no banco | `pg_advisory_xact_lock` por org + loop defensivo |
| Anti retry cego | `mutations.retry: false` global |
| Anti duplo submit | `submittingRef` + `disabled={isSubmitting}` + dialog não fecha em erro |
| Sentry sem objeto cru | `normalizeError()` em todo throw |
| Sentry sem ruído | `isExpectedBusinessError()` filtra 23505 conhecido |
| Sentry sem duplicação | Apenas `MutationCache.onError`, removido `mutations.onError` |
| UX preserva form | Dialog só fecha em sucesso |
| Mensagem amigável | Toast específico para 23505 + constraint reconhecida |

## Riscos remanescentes

1. Imóveis criados **antes** desta correção podem ter property_code com gaps — sem impacto funcional
2. Se trigger falhar nas 5 tentativas (cenário extremo), insert é abortado com mensagem clara — usuário pode tentar de novo
3. Outras mutations no app que dependiam do retry: 1 podem precisar de revisão pontual — risco baixo, retry de mutation é geralmente anti-pattern

## Checklist de testes

- [ ] Criar imóvel novo → property_code sequencial correto, sem 409
- [ ] Duplo clique rápido em "Cadastrar" → apenas 1 POST, 1 imóvel
- [ ] Enter + click simultâneo → apenas 1 criação
- [ ] Simular 2 inserts concorrentes (devtools throttling + 2 abas) → ambos sucedem com codes diferentes
- [ ] Forçar 23505 (passar `property_code` manual já existente) → toast amigável, dialog fica aberto, dados preservados
- [ ] Verificar Sentry: erro 23505 não aparece (filtrado como expected) ou aparece com `Error` real + tags `pg_code: 23505`, `pg_constraint`
- [ ] Verificar que erro inesperado (ex: 500) ainda chega no Sentry corretamente
- [ ] Mutation lenta + clicks repetidos → 1 request

