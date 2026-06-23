## Plano — Testes automatizados + página de debug de visibilidade

### 1) Testes unitários (Vitest)

Sob `src/test/`:

**`marketplace.test.ts`**
- Mock do client `supabase`.
- Regressão: `useMarketplace` NÃO chama `.neq("organization_id", ...)`.
- Dado dataset com properties das orgs A e B publicadas → hook retorna ambas.
- `publishToMarketplace` faz `upsert` em `marketplace_properties` com `is_active=true`.

**`amenities.test.ts`**
- Mock retorna amenities com `organization_id=NULL` (globais) e `organization_id=A`.
- `usePropertyAmenities` retorna ambos e ordena globais (`is_default DESC`) primeiro.
- Helper `canEditAmenity(amenity, orgId)` extraído de `AmenitiesPickerDialog`: `false` para globais, `true` para itens da org.

**`acceptInvite.test.ts`** (React Testing Library)
- Mock `supabase.functions.invoke('accept-invite-signup')` + `signInWithPassword`.
- Sucesso → navega `/dashboard`, sem tela "verifique seu email".
- 409 `email_already_registered` + senha correta → faz login + invoca `accept-invite` + vai a `/dashboard`.
- 409 + senha errada → toast "Senha incorreta" e redireciona para `/auth`.
- Erro de código de org → mostra erro no campo `orgCode`.

### 2) Testes de integração — migration / RLS / edge function

Rodam apenas quando `SUPABASE_SERVICE_ROLE_KEY` está disponível (via `.env`); usam `it.skipIf(!hasEnv)` para não quebrar CI sem segredos.

**`src/test/amenities-rls.test.ts`**
- Setup (service role): cria orgs A e B + 1 amenity global + 1 da org A + 1 da org B.
- Logado como user da org A: `SELECT` retorna global + da org A; nenhum da org B.
- Tentar `UPDATE` no global como org A → falha (RLS).
- `INSERT` com `organization_id=NULL` como org A → falha.
- `INSERT` com `organization_id` da própria org → sucesso.
- Cleanup ao final.

**`src/test/marketplace-rls.test.ts`**
- Setup: publica property na org A.
- Logado como user da org B: `marketplace_properties_public` contém a property.
- Despublica → some.

**`supabase/functions/accept-invite-signup/index.test.ts`** (Deno test)
- `import "https://deno.land/std@0.224.0/dotenv/load.ts"`.
- Cria invite via service role → chama a função → confirma: usuário existe com `email_confirmed_at`, invite `accepted`, profile com `organization_id`.
- Casos negativos: código incorreto → 400, invite expirado → 400, email duplicado → 409.
- Cleanup completo (deleta user, invite, profile).

### 3) Página de debug `/dev/visibility`

Nova rota só para `developer` (gate via `useUserRole`) em `src/pages/dev/VisibilityDebug.tsx`, registrada em `App.tsx` e linkada em `DeveloperDashboard.tsx`.

3 abas, todas read-only:

**A) Properties × Organizations**
- Tabela: `code, title, organization.name, status, marketplace.is_active, updated_at`.
- Filtros: por org, por status, "só publicadas no marketplace".

**B) Amenities globais vs por org**
- Tab 1: catálogo global (`organization_id IS NULL`) + contagem de uso entre orgs.
- Tab 2: por organização — destaca nomes que duplicam o global (mesma `lower(name)`) → sinaliza dados que podem ser deduplicados depois.
- Tab 3: orgs sem nenhum amenity próprio (sanity check do catálogo global).

**C) Convites pendentes**
- `organization_invites` com `status, email, expires_at, organization.name`.
- Coluna calculada cruzando com `profiles.email`: "usuário já tem conta?" → ajuda a entender o caso `email_already_registered`.

Dados via 3 RPCs novas (security definer, restritas a `has_role(auth.uid(),'developer')`):
- `debug_properties_visibility()`
- `debug_amenities_overview()`
- `debug_invites_overview()`

### 4) Scripts e CI

- `package.json`: adicionar `"test:rls": "vitest run src/test/*-rls.test.ts"` separado do `test`.
- `vitest.config.ts` já está OK (não muda).
- `.github/workflows/ci.yml`: rodar `vitest run` sempre; rodar `test:rls` e `supabase functions test` apenas quando `SUPABASE_SERVICE_ROLE_KEY` estiver disponível.

### Ordem de execução

1. Migration com as 3 RPCs `debug_*`.
2. Página `VisibilityDebug.tsx` + rota + link no Developer Dashboard.
3. Testes unitários (3 arquivos em `src/test/`).
4. Testes de integração RLS + teste Deno da edge function.
5. Ajustes em CI/scripts.
6. Rodar `vitest run` e `supabase--test_edge_functions` para validar.

### Fora de escopo

- Não vou alterar a lógica de Marketplace / amenities / convite (já feita) — só cobrir com testes e expor o debug.
- Não vou criar fixtures permanentes no banco; cada teste de integração cria e limpa.
- Não vou implementar deduplicação automática de amenities — a página só sinaliza.
