

## Diagnóstico: Login lento

### Problema raiz

Ao fazer login, há uma **cascata sequencial de requisições** que bloqueia a tela no spinner "Carregando sua sessão...":

```text
1. getSession() → fetchProfile() → fetchOrg()     [AuthContext]
   ↓ (onAuthStateChange TAMBÉM dispara fetchProfile de novo = duplicado)
2. useUserRoles()                                   [ProtectedRoute]
3. useSubscription() → depende de orgId do profile  [useFreeTrialExpired]
4. useFreeTrialExpired() resolve                    [ProtectedRoute]
```

O `ProtectedRoute` aguarda **todos** (`loading`, `rolesLoading`, `freeLoading`) antes de renderizar. Isso gera ~4-6 requisições sequenciais ao banco.

Além disso, `onAuthStateChange` e `getSession` **ambos** chamam `fetchProfile`, causando requisições duplicadas.

### Plano de correção

**1. Eliminar fetchProfile duplicado no AuthContext**
- Adicionar um `ref` (`profileFetchedRef`) para evitar que `onAuthStateChange` busque o perfil quando `getSession` já o fez (e vice-versa). Garantir que `fetchProfile` execute apenas uma vez por login.

**2. Paralelizar queries no AuthContext**
- Buscar `profile` e `organization` em paralelo usando `Promise.all` ao invés de sequencialmente (fetchProfile faz profile → depois org).

**3. Paralelizar as verificações no ProtectedRoute**
- Passar `organization_id` do profile diretamente para `useSubscription` com `enabled: !!orgId`, em vez de depender do hook reativo. As queries de `useUserRoles` e `useSubscription` já rodam em paralelo via React Query — o problema é que `useFreeTrialExpired` chama `useSubscription()` sem `enabled`, causando fetch imediato antes do orgId estar disponível.
- Garantir que `useSubscription` dentro de `useFreeTrialExpired` use `enabled` baseado no `orgId`.

### Alterações técnicas

**Arquivo: `src/contexts/AuthContext.tsx`**
- Adicionar `profileFetchedRef` para prevenir dupla execução
- Dentro de `fetchProfile`, buscar profile e org com `Promise.all` (a query de org depende do resultado do profile, então manter sequencial mas com timeout menor)
- No `onAuthStateChange`, verificar se `getSession` já completou antes de buscar novamente

**Arquivo: `src/hooks/useFreeTrialExpired.ts`**
- Nenhuma mudança necessária — `useSubscription` já usa `enabled: !!orgId`

**Arquivo: `src/components/ProtectedRoute.tsx`**
- Nenhuma mudança estrutural — já consome os hooks corretamente

**Resultado esperado**: Login passa de ~3-5s de spinner para ~1-2s, eliminando requisições duplicadas e a cascata desnecessária.

