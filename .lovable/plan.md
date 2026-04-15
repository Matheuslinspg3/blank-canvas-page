

# Plano: Fase 0 — Hardening de Segurança (6 Edge Functions)

## Resumo

Aplicar hotfixes P0 em 6 Edge Functions para eliminar vetores exploráveis reais: JWT decode manual, org spoofing, acesso cross-org, e autorização fraca. Criar um helper compartilhado mínimo para auth+role+org scope.

## Análise das vulnerabilidades encontradas

| Function | Vulnerabilidade | Severidade |
|---|---|---|
| `cloudflare-purge-cache` | Usa `getClaims` sem verificar role/allowlist, qualquer usuário autenticado pode purgar cache | P0 |
| `send-push` | Aceita anon key como auth, permite envio para qualquer `user_id` sem verificação org scope | P0 |
| `ticket-chat` | Não valida que o ticket pertence à org do chamador — acesso cross-org possível | P0 |
| `ai-router` | Usa `body.organization_id` e `body.user_id` diretamente para billing/logging — org spoofing | P0 |
| `meta-sync-leads` | Decode manual de JWT (`atob(token.split(".")[1])`) — sem verificação de assinatura | P0 |
| `meta-sync-entities` | Idem — decode manual de JWT sem verificação de assinatura | P0 |

## Implementação

### A. Criar helper compartilhado `_shared/auth-helpers.ts` (NOVO)

Módulo enxuto e reutilizável com:
- `resolveAuthContext(req)` — valida JWT via `getClaims`, resolve `user_id`, `email`, `organization_id` (via profiles), e `roles` (via user_roles). Retorna tudo num objeto tipado.
- `requireRole(ctx, roles[])` — verifica se o usuário tem pelo menos um dos roles especificados.
- `isInternalCall(req)` — verifica header `X-Webhook-Secret` contra env var para chamadas internas (n8n/triggers).
- `isAdminAllowlisted(supabase, email)` — verifica `admin_allowlist`.

### B. `cloudflare-purge-cache` — Restringir a developer/admin allowlisted

- Substituir `getClaims` por `resolveAuthContext`.
- Verificar role `developer` OU email em `admin_allowlist`.
- Adicionar rate limit via `checkRateLimit` (3 req/hora por user).
- Inserir audit log em `maintenance_audit_log` (action: "cache_purge").
- Negar acesso para qualquer outro perfil.

### C. `send-push` — Eliminar auth fraca + validar org scope

- Separar dois caminhos de auth:
  1. **Chamada interna** (n8n/triggers): validar via `X-Webhook-Secret` header OU `service_role_key` — manter compatibilidade.
  2. **Chamada de usuário**: validar JWT via `resolveAuthContext`, exigir role `admin`/`sub_admin`/`developer`.
- Para chamadas de usuário: verificar que `target user_id` pertence à mesma `organization_id` do chamador (query em `profiles`).
- Remover a lógica que aceita `anon key` como autorização.
- Adicionar log estruturado com `caller_id`, `target_user_id`, `auth_method`.

### D. `ticket-chat` — Validar ownership org do ticket

- Após obter o ticket, verificar que `ticket.organization_id` (ou `ticket.user_id` → profile → org) pertence à mesma org do chamador.
- Se não existir `organization_id` no ticket, derivar via `profiles` do `ticket.created_by` ou `ticket.user_id`.
- Negar acesso cross-org com exceção explícita para role `developer` (com comentário).

### E. `ai-router` — Ignorar `organization_id` do body

- Derivar `organization_id` exclusivamente do `authUserId` via `profiles`.
- Se `body.organization_id` divergir do derivado, logar a divergência como warning (não bloquear, para debugging).
- Usar org derivada para budget check, billing, logging, spend tracking.
- Manter `body.user_id` ignorado também — usar `authUserId` para tudo.

### F. `meta-sync-leads` — Substituir decode manual por getClaims

- Remover `JSON.parse(atob(token.split(".")[1]))`.
- Usar `resolveAuthContext` (que internamente usa `getClaims`).
- Manter lógica de negócio inalterada.

### G. `meta-sync-entities` — Idem + proteção mínima

- Remover decode manual de JWT.
- Usar `resolveAuthContext`.
- Adicionar rate limit leve (10 req/hora por org) via `checkRateLimit`.
- Manter lógica de negócio inalterada.

## Arquivos alterados

1. `supabase/functions/_shared/auth-helpers.ts` — **NOVO** (helper compartilhado)
2. `supabase/functions/cloudflare-purge-cache/index.ts` — auth + role + rate limit + audit
3. `supabase/functions/send-push/index.ts` — auth refactor + org scope
4. `supabase/functions/ticket-chat/index.ts` — org ownership validation
5. `supabase/functions/ai-router/index.ts` — org derivation fix (linhas ~675-680 e ~840-860)
6. `supabase/functions/meta-sync-leads/index.ts` — JWT validation fix
7. `supabase/functions/meta-sync-entities/index.ts` — JWT validation fix + rate limit

## O que NÃO será alterado nesta fase

- Nenhuma mudança de schema/banco
- Nenhuma alteração em `platform-signup`, `send-reset-email`, `whatsapp-webhook-config`, `user_roles`
- Nenhuma refatoração de negócio
- Nenhuma alteração no frontend

## Critérios de aceite

- `cloudflare-purge-cache`: rejeita usuário sem role `developer` e sem allowlist
- `send-push`: rejeita envio cross-org para chamadas de usuário
- `ticket-chat`: rejeita acesso a tickets de outra org
- `ai-router`: billing/logs usam org derivada do JWT, não do body
- `meta-sync-leads` e `meta-sync-entities`: JWT validado por `getClaims`, não por `atob`

