

# Plano: Revisão e Fechamento da Fase 0

## Diagnóstico

Após revisar todos os 7 arquivos alterados, a implementação da Fase 0 está **substancialmente completa**. Todas as vulnerabilidades P0 foram corrigidas. Restam apenas ajustes de documentação no código.

## Verificação por função

### ai-router — COMPLETO
- Linhas 674-690: `organization_id` e `user_id` do body são **ignorados**
- `orgId` é derivado exclusivamente do JWT (`authUserId` → `profiles.organization_id`)
- Divergências são logadas como warning (não bloqueiam, para debugging)
- Billing (linha 855), spend tracking (linha 867) e logging usam `orgId` derivado

### meta-sync-leads — COMPLETO
- JWT validado via `getClaims` (linhas 24-35), nenhum `atob` presente
- `userId` derivado de `claims.sub`, `orgId` derivado via `profiles`

### meta-sync-entities — COMPLETO
- JWT validado via `getClaims` (linhas 26-37), nenhum `atob` presente
- Rate limit de 10 req/hora por org (linhas 52-59)

### cloudflare-purge-cache — COMPLETO
- Requer role `developer` OU `admin_allowlist`
- Rate limit 3 req/h, audit log em `audit_events`

### send-push — COMPLETO
- Dois caminhos: interno (`isInternalCall`) e JWT (requer `admin`/`sub_admin`/`developer` + org scope)

### ticket-chat — COMPLETO
- Cross-org bloqueado por padrão
- Developer pode acessar qualquer ticket (exceção explícita com comentário)
- Dentro da mesma org, qualquer usuário autenticado pode acessar (ownership fino por `user_id` **não implementado** — pendência Fase 1)

## Única alteração necessária

### `_shared/auth-helpers.ts` — Adicionar documentação transitória em `isInternalCall`

Adicionar comentário explícito de que `isInternalCall` é solução transitória da Fase 0, com indicação de substituição por autenticação M2M assinada na Fase 1.

## Arquivos alterados nesta revisão
1. `supabase/functions/_shared/auth-helpers.ts` — documentação transitória em `isInternalCall`

## Resumo do estado da Fase 0

### Já seguro como hotfix
- `cloudflare-purge-cache`: bloqueado para usuários comuns, rate limited, auditado
- `send-push`: sem auth fraca, org scope enforced para chamadas de usuário
- `ticket-chat`: cross-org bloqueado, developer exception explícita
- `ai-router`: org/user derivados do JWT, body ignorado, divergências logadas
- `meta-sync-leads`: JWT validado por `getClaims`
- `meta-sync-entities`: JWT validado por `getClaims`, rate limited

### Pendências explícitas para Fase 1
- **`isInternalCall`**: substituir por autenticação M2M assinada (HMAC/JWT de serviço)
- **`ticket-chat` ownership fino**: dentro da mesma org, restringir acesso ao dono do ticket ou roles admin/sub_admin
- **Rate limit em `meta-sync-leads`**: adicionar rate limit (hoje só `meta-sync-entities` tem)
- **Audit log em `send-push`**: registrar envios em tabela de auditoria
- **Input validation (Zod)**: adicionar validação de schema nos bodies de todas as 6 functions

