## Causa raiz (final)

`INSERT … .select().single()` exige que a linha recém-criada também passe pelo USING do SELECT. Para corretor/assistente isso falha quando `broker_id` é nulo ou pertence a outro usuário. A correção combina **policy + trigger no banco** com **gate de papel diferenciado no frontend** (corretor ≠ assistente).

## Regra de produto final

| Papel | INSERT sem `broker_id` | INSERT com `broker_id = self` | INSERT com `broker_id = outro` | UPDATE: transferir broker | UPDATE: desatribuir (`broker_id → NULL`) |
|---|---|---|---|---|---|
| corretor | ✅ frontend preenche `self` | ✅ | ❌ toast | ❌ | ❌ (bloqueado) |
| assistente | ✅ permanece `NULL` | ❌ toast (não pode ser responsável) | ❌ toast | ❌ | ❌ |
| admin / sub_admin / leader / developer | ✅ | ✅ | ✅ (broker elegível da mesma org) | ✅ | ✅ |

Regra extra: corretor **não** pode desatribuir o próprio lead (não pode mover para `NULL`); só manager pode.

## Migration

`supabase/migrations/20260427211423_fix_leads_rls_select_update.sql`

### Helpers (SECURITY DEFINER)
- `public.is_org_manager(_uid uuid) returns boolean` — true se `_uid` tem `admin | sub_admin | leader | developer`.
- `public.is_lead_eligible_responsible(_uid uuid, _org uuid) returns boolean` — true se `_uid` pertence à org `_org` E tem role `corretor | admin | sub_admin | leader | developer` (assistente é falso).

### Policies (todas com `DROP POLICY IF EXISTS` antes)

**INSERT**
```sql
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    public.is_org_manager(auth.uid())
    OR broker_id IS NULL
    OR broker_id = auth.uid()
  )
)
```
`created_by` não é checado aqui porque o trigger BEFORE INSERT vai forçar `auth.uid()`.

**SELECT (USING)**
```sql
USING (
  is_member_of_org(organization_id) AND (
    public.is_org_manager(auth.uid())
    OR broker_id = auth.uid()
    OR (created_by = auth.uid() AND broker_id IS NULL)
  )
)
```
A última cláusula garante que assistente (e corretor antes do preenchimento) leia a linha recém-criada sem responsável.

**UPDATE (USING idêntica ao SELECT)**

**UPDATE WITH CHECK**
```sql
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    public.is_org_manager(auth.uid())
    OR (
      -- corretor/assistente: broker_id final só pode ser self
      -- (impede transferência E impede desatribuir)
      broker_id = auth.uid()
    )
  )
)
```
Consequência: corretor não consegue passar `broker_id` para `NULL` nem para outro usuário. Assistente não consegue editar nada que altere `broker_id` para outro valor que não seja ele mesmo — e como assistente nunca é responsável, na prática o UPDATE de assistente sobre leads onde `broker_id IS NULL AND created_by = self` precisa preservar `broker_id IS NULL`. Para suportar isso, ajustamos:

```sql
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    public.is_org_manager(auth.uid())
    OR broker_id = auth.uid()
    OR (broker_id IS NULL AND created_by = auth.uid())
  )
)
```
Isso dá: assistente pode continuar editando o próprio lead enquanto `broker_id` permanecer `NULL`; corretor pode editar enquanto `broker_id` permanecer ele mesmo. Nenhum dos dois consegue transferir.

### Trigger `protect_lead_authorship_and_broker` (BEFORE INSERT OR UPDATE)
- **INSERT**: `NEW.created_by := auth.uid();` (autoridade do banco; frontend não decide).
- **UPDATE**: `NEW.created_by := OLD.created_by;` (imutável).
- **INSERT/UPDATE**: se `NEW.broker_id IS NOT NULL`, validar:
  - broker pertence à mesma `organization_id` do lead (cruzando `profiles`);
  - `public.is_lead_eligible_responsible(NEW.broker_id, NEW.organization_id)` — bloqueia atribuir a assistente.
- Erros via `RAISE EXCEPTION USING ERRCODE = 'check_violation'`.

## Frontend

### `src/hooks/useLeads.ts`
Substituir `isBrokerOnly` por dois flags:
```ts
const isCorretorOnly  = userRoles.length > 0 && userRoles.every(r => r === 'corretor');
const isAssistenteOnly = userRoles.length > 0 && userRoles.every(r => r === 'assistente');
```
Repassar ambos para `useLeadCRUD`. Lista de leads continua filtrando por `broker_id === user.id` para corretor; para assistente, mostrar leads onde `created_by === user.id AND broker_id IS NULL` (até existir regra de produto mais ampla).

### `src/hooks/useLeadCRUD.ts`
- Aceitar `{ leadStages, isCorretorOnly, isAssistenteOnly }`.
- Helper `isRlsError(e)`: `e?.code === '42501' || /row-level security/i.test(e?.message ?? '')`.

**createLead.mutationFn (gate antes do insert)**
```ts
const payload = { ...rest };

if (isCorretorOnly) {
  if (payload.broker_id && payload.broker_id !== user.id) {
    throw new Error('Corretores não podem atribuir leads diretamente para outro responsável.');
  }
  payload.broker_id = user.id;
}

if (isAssistenteOnly) {
  if (payload.broker_id) {
    throw new Error('Assistentes não podem atribuir leads diretamente para outro responsável.');
  }
  // mantém broker_id ausente → NULL
}

// não envia created_by (trigger preenche)
const { data, error } = await supabase.from('leads').insert({
  ...payload, organization_id: profile.organization_id,
  lead_stage_id: lead_stage_id || defaultStageId, stage: 'novo',
}).select(`*, lead_type:lead_types(*)`).single();
```

**updateLead.mutationFn (mesmo gate antes do update)**
```ts
if (isCorretorOnly) {
  if ('broker_id' in input && input.broker_id !== user.id) {
    throw new Error('Corretores não podem alterar o responsável do lead.');
  }
}
if (isAssistenteOnly) {
  if ('broker_id' in input && input.broker_id) {
    throw new Error('Assistentes não podem atribuir leads a um responsável.');
  }
}
```

**onError em ambos**
```ts
if (isRlsError(error)) {
  toast({ title: 'Permissão negada', description: 'Você não tem permissão para esta ação.', variant: 'destructive' });
  console.error('[leads] RLS denied', { code: error.code, orgId: profile?.organization_id, userId: user?.id });
  return;
}
```

### `src/components/crm/KanbanBoard.tsx`
Envolver `handleFormSubmit` em `try/catch` para evitar Unhandled Promise Rejection no Sentry; toast já é mostrado pelas mutações.

## Arquivos alterados

- `supabase/migrations/20260427211423_fix_leads_rls_select_update.sql` (novo, com `DROP POLICY IF EXISTS`)
- `src/hooks/useLeads.ts` (split de flags)
- `src/hooks/useLeadCRUD.ts` (gates por papel + tratamento 42501 + remover envio de `created_by`)
- `src/components/crm/KanbanBoard.tsx` (try/catch)

## Checklist de testes

| # | Cenário | Esperado |
|---|---|---|
| 1 | Corretor cria lead sem broker | OK; trigger preenche `created_by`; frontend preenche `broker_id = self`; INSERT-RETURNING retorna 200 |
| 2 | Assistente cria lead sem broker | OK; `broker_id` permanece NULL; SELECT passa via `created_by = auth.uid() AND broker_id IS NULL` |
| 3 | Assistente tenta atribuir broker no formulário | Bloqueado no frontend com toast; nenhum POST disparado |
| 4 | Admin cria lead para corretor X | OK |
| 5 | Corretor tenta transferir lead próprio para outro corretor | Bloqueado no frontend; se forçado via API, bloqueado pelo UPDATE WITH CHECK |
| 6 | Corretor tenta desatribuir o próprio lead (`broker_id → NULL`) | Bloqueado pelo UPDATE WITH CHECK |
| 7 | Manager tenta atribuir lead a um assistente | Bloqueado pelo trigger (`is_lead_eligible_responsible` = false) |
| 8 | Tentativa de spoofar `created_by` em UPDATE | Trigger restaura `OLD.created_by` |
| 9 | INSERT com `broker_id` de outra org | Trigger lança `check_violation` |
| 10 | `npx tsc --noEmit`, `npx vite build`, `supabase--linter` | Verde |
| 11 | Sentry pós-deploy | Sem novos `Unhandled Promise Rejection` em KanbanBoard nem `42501` no fluxo normal |

## Riscos

Baixo. Defesa em três camadas (frontend, policy, trigger). Multi-tenant preservado por `is_member_of_org` em todas as policies. A regra "assistente nunca é responsável" pode ser flexibilizada no futuro alterando apenas `is_lead_eligible_responsible`.
