
# Fase 1 — Security Core, Controle de Roles Server-Side e Auditoria Imutável

## Resumo

Criar infraestrutura de segurança reutilizável, bloquear mutação direta de `user_roles` pelo frontend, centralizar tudo em `manage-member`, e criar tabela de auditoria imutável com cadeia de hash.

## Diagnóstico Atual

- **4 componentes frontend** escrevem diretamente em `user_roles` via Supabase client (TeamDashboard, SettingsTeamTab, RolesTab, UsersTab)
- `user_roles` tem RLS policies que permitem INSERT/UPDATE/DELETE para `authenticated` com validações parciais
- `manage-member` já existe com `remove_member` e `get_member_stats`, mas **não tem action para change_role**
- `_shared/auth-helpers.ts` (Phase 0) já tem `resolveAuthContext`, `requireRole`, `isInternalCall`
- `audit_events` já existe com schema rico — pode ser estendido ou usado como base

## Implementação

### 1. Security Core (`_shared/`)

Criar módulos reutilizáveis complementando o `auth-helpers.ts` existente:

**`_shared/security-core.ts`** — Fachada unificada que re-exporta e compõe:
- `requireAuth(req)` — wrapper de `resolveAuthContext` que retorna ctx ou throws/Response
- `requireRole(ctx, roles)` — já existe, re-exportar
- `requireOrgScope(ctx, targetOrgId)` — verifica se ctx.organizationId === targetOrgId
- `requireOwnership(ctx, resourceOwnerId)` — verifica ctx.userId === ownerId OR has elevated role
- `auditLog(event)` — helper para inserir em `security_audit_events`

**`_shared/security-errors.ts`** — Respostas padronizadas:
- `unauthorizedResponse()`, `forbiddenResponse()`, `rateLimitedResponse()`, `badRequestResponse()`

**`_shared/security-signature.ts`** — M2M melhorado:
- `requireWebhookSignature(req)` — HMAC-SHA256 sobre body + timestamp (substitui `isInternalCall`)
- Replay protection via timestamp window (5 min)
- Backward-compatible: aceita `isInternalCall` antigo + novo HMAC

**`_shared/security-rate-limit.ts`** — Re-export do `rate-limiter.ts` com interface padronizada

### 2. Tabela `security_audit_events` (Migration)

```sql
CREATE TABLE public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,          -- 'role_change', 'auth_deny', 'rate_limit', ...
  severity text NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'critical'
  endpoint text,
  actor_type text NOT NULL DEFAULT 'user', -- 'user', 'system', 'webhook'
  actor_user_id uuid,
  actor_org_id uuid,
  target_type text,                  -- 'user', 'ticket', 'org'
  target_id text,
  decision text NOT NULL,            -- 'allow', 'deny'
  reason_code text,
  request_id text,
  ip inet,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  prev_hash text,
  event_hash text
);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

-- Append-only: no UPDATE/DELETE policies, only INSERT via service_role
-- SELECT only for developers
CREATE POLICY "Developers can read audit" ON public.security_audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Prevent any client INSERT/UPDATE/DELETE
-- All writes go through service_role in Edge Functions
```

### 3. `manage-member` — Adicionar action `change_role`

Novo action `change_role` no endpoint existente:

```
POST { action: "change_role", user_id, new_role, reason? }
```

Matriz de permissão server-side:
| Caller | Pode atribuir |
|--------|--------------|
| developer | qualquer role (com allowlist check para developer→developer) |
| admin | sub_admin, corretor, assistente (não developer/leader/admin) |
| sub_admin | corretor, assistente |
| leader | nenhum (read-only nesta fase) |
| corretor/assistente | nenhum |

Obrigatório:
- Validar org scope (target na mesma org)
- Não pode alterar próprio role
- Registrar em `security_audit_events` (old_role → new_role, actor, target)
- Validar que new_role é um enum válido

### 4. RLS em `user_roles` — Bloquear mutação direta

Migration para revogar INSERT/UPDATE/DELETE do `authenticated`:

```sql
DROP POLICY "Org admins can insert roles (no escalation)" ON public.user_roles;
DROP POLICY "Secure role updates" ON public.user_roles;
DROP POLICY "Secure role deletion" ON public.user_roles;

-- Keep only SELECT
-- INSERT/UPDATE/DELETE only via service_role (Edge Functions)
```

A policy de SELECT permanece inalterada.

### 5. Frontend — Substituir escrita direta por `manage-member`

Criar hook `useChangeRole()` que chama `manage-member` com `action: "change_role"`:

**Arquivos modificados:**
- `src/hooks/useTeamMembers.ts` — adicionar `useChangeRole` mutation
- `src/components/admin/TeamDashboard.tsx` — trocar `supabase.from("user_roles").delete/insert` por `useChangeRole`
- `src/components/settings/SettingsTeamTab.tsx` — idem
- `src/components/developer/RolesTab.tsx` — idem (addRole e removeRole)
- `src/components/developer/UsersTab.tsx` — idem (toggleRole)

### 6. Integração com endpoints P0

Adicionar `auditLog()` calls nos endpoints já hardened:
- `cloudflare-purge-cache` — já audita em `audit_events`, migrar para `security_audit_events`
- `send-push` — adicionar audit de envios cross-org negados
- `ticket-chat` — adicionar audit de acessos cross-org negados
- `ai-router` — adicionar audit de org_id divergence
- `manage-member` — audit completo de role changes e member removals

## Arquivos alterados

### Novos
1. `supabase/functions/_shared/security-core.ts`
2. `supabase/functions/_shared/security-errors.ts`
3. `supabase/functions/_shared/security-signature.ts`
4. `supabase/functions/_shared/security-rate-limit.ts`

### Modificados (Backend)
5. `supabase/functions/manage-member/index.ts` — add `change_role` action + audit
6. `supabase/functions/cloudflare-purge-cache/index.ts` — use security-core
7. `supabase/functions/send-push/index.ts` — add audit
8. `supabase/functions/ticket-chat/index.ts` — add audit
9. `supabase/functions/ai-router/index.ts` — add audit

### Modificados (Frontend)
10. `src/hooks/useTeamMembers.ts` — add `useChangeRole`
11. `src/components/admin/TeamDashboard.tsx` — use `useChangeRole`
12. `src/components/settings/SettingsTeamTab.tsx` — use `useChangeRole`
13. `src/components/developer/RolesTab.tsx` — use `useChangeRole`
14. `src/components/developer/UsersTab.tsx` — use `useChangeRole`

### Migrations
15. Create `security_audit_events` table
16. Drop INSERT/UPDATE/DELETE policies on `user_roles`

## O que fica para Fase 2
- Migração completa de TODOS os endpoints para security-core (apenas P0 nesta fase)
- Zod validation em todos os inputs
- Dashboard de auditoria no frontend
- Rotação automática de HMAC keys
- Fine-grained ticket ownership (dentro da mesma org)
