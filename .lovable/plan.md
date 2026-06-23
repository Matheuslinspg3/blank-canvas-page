
## Plano único — 3 frentes

### 1) Marketplace: ver imóveis de outras contas

**Diagnóstico.** A view `marketplace_properties_public` está OK. O hook `useMarketplace` filtra explicitamente `organization_id != minha_org`. Hoje, no banco, todos os 4 imóveis publicados pertencem à mesma organização do usuário logado — por isso o Marketplace fica vazio.

Não é bug de RLS nem da publicação. É o filtro de "ocultar minha própria org" + ainda não existirem imóveis publicados de outras orgs.

**Mudanças:**
- Em `src/hooks/useMarketplace.ts`: remover o `query.neq("organization_id", organizationId)` e, no agrupamento por organização em `src/pages/Marketplace.tsx`, marcar visualmente a seção da própria org como "Meus imóveis publicados" (apenas badge), mantendo a ordem normal. Assim o usuário enxerga inclusive o que ele mesmo publicou.
- Adicionar um toggle simples no header do Marketplace: "Mostrar apenas outras imobiliárias" (default ligado para clientes externos, desligado para o próprio dono — controle só no estado local, sem mexer em backend).
- Verificar que o botão "Publicar no Marketplace" (em `usePropertyBulkOps.publishToMarketplace`) está fazendo `upsert` em `marketplace_properties` corretamente — já está; sem alteração necessária.

### 2) Convite de equipe — eliminar a confirmação manual de email

**Diagnóstico.** Fluxo atual em `src/pages/AcceptInvite.tsx`:
1. Convidado abre `/convite/:id`, preenche código da imobiliária + dados.
2. Chama `supabase.auth.signUp(...)` → Supabase envia email de confirmação.
3. Tela "Verifique seu email" só mostra "clique no link" — **não há campo de OTP**.

Usuários estão recebendo email com código numérico (template padrão Supabase) e procurando onde digitar, mas a UI só aceita o link mágico. Quando o email demora ou cai no spam, eles travam.

**Solução escolhida (sem código manual, sem fricção):** criar a conta já confirmada via edge function com service role, e logar o usuário imediatamente.

**Mudanças:**
- Nova edge function `accept-invite-signup` (Deno + service role) que:
  1. Valida `invite_id` em `organization_invites` (pending, não expirado).
  2. Valida `org_code` via RPC `validate_invite_org_code`.
  3. Cria o usuário com `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
  4. Aciona o trigger `handle_new_user` (já existe) que cria o profile.
  5. Marca o invite como `accepted`, vincula `organization_id` ao profile, atribui role.
  6. Retorna `{ success: true }`.
- Em `AcceptInvite.tsx`:
  - `handleSignup` chama essa nova função em vez de `auth.signUp`.
  - Em seguida faz `supabase.auth.signInWithPassword(...)` para logar automaticamente.
  - Remover totalmente a tela `waitingEmailConfirmation` e o estado relacionado.
  - Se a edge function retornar `email_already_registered`, mostrar mensagem clara com botão "Ir para login e aceitar convite".
- Manter `accept-invite` (auto-accept para usuário já logado) sem alterações.

Resultado: convidado preenche o formulário uma única vez e cai direto no `/dashboard`. Nenhum email de confirmação, nenhum código para digitar.

### 3) Características de imóveis — catálogo global + customizações por org

**Diagnóstico.** Tabela `property_amenities` tem `organization_id NOT NULL` e RLS escopa por org. Cada nova imobiliária começa zerada.

**Mudanças (migration):**
- Tornar `organization_id` **nullable** em `property_amenities`. Linhas com `organization_id IS NULL` viram o **catálogo global** (read-only para todos, gerenciado por `developer`).
- Atualizar políticas RLS:
  - `SELECT`: `organization_id IS NULL OR organization_id IN (minha org)` — todos veem global + suas próprias.
  - `INSERT`: continua exigindo `organization_id = minha org` (orgs não conseguem criar globais; só developers via service role).
  - `UPDATE`/`DELETE`: só linhas da própria org **e** `organization_id IS NOT NULL` (proteção dupla).
- Constraint de unicidade: trocar `UNIQUE(organization_id, name)` por índice único composto que trate o `NULL` corretamente (`UNIQUE NULLS NOT DISTINCT (organization_id, lower(name))`) — evita duplicatas globais e permite que cada org tenha sua própria customização sem colidir com a global.
- **Seed do catálogo global** a partir da união das amenities mais usadas hoje (deduplicar por nome normalizado, marcar `is_default=true`, `organization_id=NULL`). Categorias preservadas; em caso de divergência, manter a categoria mais frequente.
- Limpeza opcional (em outra etapa, sob aprovação): remover linhas duplicadas por org que já existam no global.

**Frontend (`usePropertyAmenities.ts` e `AmenitiesPickerDialog.tsx`):**
- Remover o `.eq("organization_id", orgId)` no `SELECT` — RLS já garante visibilidade correta (global + própria org).
- Ordenar por `is_default DESC, category, name` (globais aparecem primeiro).
- Permitir editar/excluir só quando `organization_id` da linha == minha org (já é o comportamento de RLS; só esconder os botões para itens globais).

## Detalhes técnicos (resumo)

```text
Marketplace
  useMarketplace.ts            -> remover filtro neq(organization_id)
  Marketplace.tsx              -> toggle "outras imobiliárias", badge "Minha org"

Convite
  supabase/functions/accept-invite-signup/index.ts   (novo)
    - admin.createUser({ email_confirm: true })
    - marca organization_invites.status='accepted'
  AcceptInvite.tsx
    - handleSignup -> invoke('accept-invite-signup')
    - signInWithPassword -> /dashboard
    - remover waitingEmailConfirmation

Amenities
  migration:
    ALTER property_amenities ALTER COLUMN organization_id DROP NOT NULL;
    DROP/RECREATE índice único c/ NULLS NOT DISTINCT;
    UPDATE policies (SELECT/INSERT/UPDATE/DELETE);
    INSERT seed global a partir de amenities existentes mais comuns.
  usePropertyAmenities.ts -> remover eq org, ordenar com is_default first
  AmenitiesPickerDialog.tsx -> esconder edit/delete em itens globais
```

## Ordem de execução

1. Migration de `property_amenities` (com seed global).
2. Edge function `accept-invite-signup` + ajustes em `AcceptInvite.tsx`.
3. Ajustes em `useMarketplace.ts` / `Marketplace.tsx`.
4. Verificação manual: publicar imóvel em uma org, abrir Marketplace em outra org de teste, convidar um email novo e confirmar entrada direta no dashboard.

## Fora de escopo

- Não vou mexer no fluxo de PlatformInvite (signup novo de imobiliária) — só no convite de equipe.
- Não vou reescrever o sistema de templates de email do Supabase.
- Não vou migrar amenities duplicadas existentes nesta etapa (faço só se você pedir, em uma segunda passada).
