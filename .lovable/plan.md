## Relatório Executivo — Erro ao criar transação

### Sintoma
Ao clicar em **Salvar** no diálogo "Nova Transação", o request falha silenciosamente (toast de erro). O log do Postgres confirma:

```
new row violates row-level security policy for table "transactions"
```

### Causa raiz
A política de INSERT da tabela `public.transactions` foi restringida em `20260217034558` para apenas 3 papéis:

```sql
CREATE POLICY "Managers can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(),'admin')
      OR has_role(auth.uid(),'leader')
      OR has_role(auth.uid(),'developer'))
  );
```

Mas o sistema de papéis em uso (`user_roles`) contém também: `corretor`, `assistente`, `sub_admin`. Nenhum desses consegue inserir, e **`leader` sequer existe nos dados** — ninguém possui esse papel hoje. Resultado: somente `admin` e `developer` conseguem criar transações; qualquer outro usuário (incluindo `sub_admin`, que é gestor) recebe violação de RLS.

O mesmo problema afeta SELECT, UPDATE e DELETE de `transactions` (todas as policies usam o mesmo trio `admin/leader/developer`), então usuários `sub_admin`/`assistente` também não veem nem editam transações existentes.

### Evidências coletadas
- Log Postgres recente: `new row violates row-level security policy for table "transactions"`
- Policies atuais em `pg_policy` confirmam o filtro restrito
- Tabela `user_roles` não possui nenhum registro com role `leader`
- Hook `useTransactions` envia payload correto (`organization_id`, `created_by`), portanto o problema não está no front

### Solução proposta

**1. Migration corrigindo as 4 policies de `public.transactions`**

Substituir o trio `admin/leader/developer` por uma checagem que cubra todos os papéis de gestão reais:

```sql
-- helper já existente: is_org_admin / has_role
-- Permitir admin, sub_admin, leader (futuro) e developer
DROP POLICY "Managers can create transactions" ON public.transactions;
CREATE POLICY "Managers can create transactions" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'sub_admin')
    OR has_role(auth.uid(),'leader')
    OR has_role(auth.uid(),'developer')
  )
);
```

Aplicar o mesmo ajuste em:
- `Managers can view transactions in their organization` (SELECT)
- `Managers can update transactions in their organization` (UPDATE)
- `Admins can delete transactions` — manter restrita a `admin` + `developer` (delete é destrutivo)

**2. Melhorar feedback de erro no front**

Em `src/hooks/useTransactions.ts`, o `onError` já mostra `error.message`, mas mensagens RLS do Postgres são técnicas. Detectar `42501`/`row-level security` e exibir:

> "Você não tem permissão para criar transações. Solicite acesso ao administrador."

**3. Validação pós-deploy**
- Rodar `supabase--test_edge_functions` não se aplica (sem edge function envolvida)
- Testar manualmente como `sub_admin` e `corretor` (decidir se `corretor` deve criar ou não — ver questão abaixo)
- Verificar que `admin` continua funcionando

### Decisão necessária
Hoje o diálogo "Nova Transação" aparece para o usuário (não há gate). Preciso confirmar **quem deve poder criar transações financeiras**:
- Opção A (recomendada): `admin`, `sub_admin`, `leader`, `developer` — gestão financeira
- Opção B: incluir também `corretor`/`assistente` (qualquer membro da org)

Vou assumir **Opção A** salvo indicação contrária — ela alinha com a intenção original da migration `20260217` (restringir a "Managers"), apenas corrigindo a lista de papéis.

### Arquivos afetados
- `supabase/migrations/<novo>_fix_transactions_rls.sql` (criar)
- `src/hooks/useTransactions.ts` (mensagens de erro mais amigáveis)
