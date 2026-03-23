# Auditoria de Identidade e Permissões — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Modelo Atual de Autenticação e Autorização

### 1.1 Tipos de Identidade

| Ator | Método de Auth | Armazenamento de Identidade | Status |
|------|---------------|---------------------------|--------|
| Usuário final (corretor/admin) | Email + senha via Supabase Auth | `auth.users` + `profiles` + `user_roles` | ✅ Implementado |
| Consumidor (app público) | Email + senha via Supabase Auth | `auth.users` (sem org) | ✅ Implementado |
| Developer/Leader (superadmin) | Email + senha + role `developer`/`leader` | `user_roles` + `admin_allowlist` | ✅ Implementado |
| Serviço automatizado (cron/webhook) | Sem auth ou anon key | Nenhuma validação | ⚠️ Parcial |
| API externa (Meta, RD Station) | OAuth callback | Tokens em texto plano no DB | ❌ Inseguro |
| Serviço interno (Edge Function → Edge Function) | Service role key | `SUPABASE_SERVICE_ROLE_KEY` | ✅ OK |

### 1.2 Hierarquia de Papéis (Atual)

```
developer       → Acesso total (plataforma + painel dev + admin global)
  └── leader    → Acesso total (sem painel dev exclusivo)
    └── admin   → Admin da organização (gestão de membros, config)
      └── sub_admin → Gerência (acesso a relatórios, gestão parcial)
        └── corretor → Operacional (imóveis, leads, contratos)
          └── assistente → Visualização limitada
            └── atendente → Role padrão (auto-assign no signup)
```

**Observação crítica:** `atendente` é atribuído pelo trigger `auto_assign_default_role` mas NÃO está no enum `app_role`. Isso é um bug silencioso — o `handle_new_user` atribui `admin` para novos cadastros self-service, então `atendente` só é usado se nenhuma role existir.

### 1.3 Mecanismo de Autorização em Camadas

| Camada | Mecanismo | Cobertura |
|--------|----------|-----------|
| **Banco (RLS)** | `has_role()`, `is_org_admin()`, `is_org_manager_or_above()`, `get_user_organization_id()`, `is_system_admin()` | ✅ 89 tabelas com RLS |
| **Edge Functions** | `auth.getUser()` ou `auth.getClaims()` + verificação de role/allowlist | ⚠️ Inconsistente (ver §2) |
| **Frontend (rotas)** | `AdminRoute`, `DeveloperRoute`, `ManagerRoute`, `useUserRoles()` | ⚠️ Apenas UI gate |
| **Frontend (componentes)** | `isAdminOrAbove`, `isDeveloper` para renderização condicional | ⚠️ Apenas UI gate |

---

## 2. Riscos de Acesso Indevido e Escalonamento de Privilégio

### 🔴 CRÍTICOS

| # | Risco | Detalhe | Impacto |
|---|-------|---------|---------|
| **S1** | `send-reset-email` sem autenticação nem rate limit | `verify_jwt=false` + aceita qualquer email + usa service_role para gerar link de recuperação. Qualquer pessoa pode bombardear emails de reset. | Abuso, enumeração de email, custo Resend |
| **S2** | `onesignal-app-id` expõe App ID sem auth | `verify_jwt=false` + nenhuma verificação. Qualquer um pode obter o OneSignal App ID. | Envio de push indesejado se REST key vazada |
| **S3** | `admin` pode escalar para `developer` via RLS | Policy `Dev or admin can update roles` permite `admin` fazer UPDATE em `user_roles`, e o WITH CHECK só protege INSERT de roles elevadas — admin pode UPDATE uma role existente de `corretor` para `developer` via query direta | **Escalonamento de privilégio** |
| **S4** | `user_roles` não tem `organization_id` — isolamento fraco | Roles são globais por usuário, sem vínculo à organização. Se um usuário tem role `admin` e troca de org via convite, mantém role `admin` na nova org | Cross-tenant privilege |
| **S5** | Profile UPDATE policy permite auto-edição sem restrição de campos | `Users can update own profile (safe fields only)` bloqueia mudança de `organization_id` mas não bloqueia `creci_verified`, `email_verified`, `phone_verified` — usuário pode se auto-verificar | **Auto-verificação fraudulenta** |
| **S6** | `cleanup-orphan-media` aceita `token === supabaseServiceKey` como auth | Compara token com service role key via igualdade de string — se a key vazar, qualquer um pode deletar mídia | Destruição de dados |
| **S7** | `meta-oauth-callback` e `rd-station-oauth-callback` com `verify_jwt=false` sem validação de state/nonce | Callbacks OAuth sem proteção CSRF. State parameter deve ser validado. | Account takeover via OAuth |

### 🟡 IMPORTANTES

| # | Risco | Detalhe |
|---|-------|---------|
| **S8** | `crm-import-leads` usa service role sem verificar auth do chamador | Aceita qualquer requisição e escreve leads diretamente — pode injetar dados |
| **S9** | Sem rate limiting em nenhuma Edge Function | Login brute force, spam de IA, abuso de envio de email |
| **S10** | `platform-signup` com `verify_jwt=false` — verificar se tem validação interna | Criação de conta sem controle |
| **S11** | Comissões: `broker_id` pode ver suas comissões mas não há validação de que `broker_id` é da mesma org | RLS verifica `is_member_of_org(organization_id)` mas o broker_id pode ser de outra org |
| **S12** | Sessão nunca expira explicitamente — Supabase default é 1 semana de refresh token | Sem logout global, sem invalidação por troca de senha |

### 🟢 BEM IMPLEMENTADOS

| Item | Implementação |
|------|--------------|
| `admin_allowlist` para funções admin globais | ✅ `is_system_admin()` verifica email via SECURITY DEFINER |
| Trigger de auditoria em `user_roles` | ✅ `audit_role_changes()` registra INSERT/DELETE/UPDATE com risk_level |
| Profile UPDATE bloqueia mudança de `organization_id` | ✅ Subquery verifica que org não muda |
| `handle_new_user` atribui org + role atomicamente | ✅ SECURITY DEFINER, trata convites |
| Funções admin (`admin_get_*`) protegidas por `is_system_admin()` | ✅ Verificação server-side |
| `export-database` protegido por `admin_allowlist` | ✅ Dupla verificação (JWT + allowlist) |
| INSERT em `user_roles` protegido contra auto-escalação | ✅ WITH CHECK impede inserir roles acima do próprio nível |

---

## 3. Lacunas em Sessão, Auditoria e Proteção de Ações Sensíveis

### 3.1 Sessão

| Aspecto | Estado Atual | Risco |
|---------|-------------|-------|
| Expiração de sessão | Default Supabase (1h access + 1 semana refresh) | 🟡 Aceitável |
| Refresh token rotation | ✅ Supabase faz automaticamente | OK |
| Logout global (revogar todas as sessões) | ❌ Não implementado | Dispositivo roubado mantém acesso |
| Invalidação por troca de senha | ❌ Não implementado | Sessões antigas continuam válidas |
| Invalidação por mudança de role | ❌ Não implementado | Usuário removido mantém sessão ativa |
| Device tracking | ❌ Não existe | Sem visibilidade de sessões ativas |
| Detecção de sessão suspeita | ❌ Não existe | Sem alertas de login incomum |
| MFA/2FA | ❌ Não implementado | Conta comprometida = acesso total |

### 3.2 Auditoria

| Ação Sensível | Auditada? | Como |
|--------------|----------|------|
| Login realizado | ❌ Não | Supabase Auth tem logs internos, mas não no app |
| Login falho | ❌ Não | Apenas resposta de erro ao usuário |
| Mudança de role | ✅ Sim | Trigger `audit_role_changes` → `audit_events` |
| Mudança de senha | ❌ Não | Nenhum log |
| Reset de senha por admin | ❌ Não | `admin-users` PATCH não registra auditoria |
| Exclusão de usuário | ❌ Não | `admin-users` DELETE não registra auditoria |
| Exportação de banco | ⚠️ Parcial | Apenas log de console na Edge Function |
| Acesso a dados financeiros | ⚠️ Parcial | Depende do frontend chamar `useAuditLog` |
| Mudança de billing/subscription | ❌ Não no app | Apenas webhook logs |
| Impersonação | N/A | Não implementado |
| Mudança de configurações de org | ⚠️ Parcial | Depende do frontend |

### 3.3 Proteção de Ações Sensíveis

| Ação | Proteção Atual | Recomendação |
|------|---------------|-------------|
| Trocar email | ❌ Sem re-autenticação | Exigir senha atual |
| Mudar senha | ⚠️ Supabase exige sessão | Exigir senha atual |
| Deletar conta | ⚠️ Só developer pode (Edge Function) | OK — mas sem log |
| Alterar billing | ⚠️ Via Asaas webhook | OK |
| Exportar dados sensíveis | ✅ `admin_allowlist` | OK |
| Promover para admin/developer | ✅ RLS WITH CHECK protege | OK — mas S3 é brecha |
| Reset de senha de outro usuário | ⚠️ Apenas role `developer` | Sem log de auditoria |

---

## 4. Matriz de Permissões Proposta

### 4.1 Matriz por Módulo (Estado Atual vs Ideal)

```
Legenda: R=Read C=Create U=Update D=Delete X=Export

Módulo          | developer | leader | admin | sub_admin | corretor | assistente
----------------|-----------|--------|-------|-----------|----------|----------
Imóveis         | RCUDX     | RCUDX  | RCUDX | RCUX      | RCUX*    | R
Leads/CRM       | RCUDX     | RCUDX  | RCUDX | RCUX      | RCU*     | R
Contratos       | RCUDX     | RCUDX  | RCUD  | RCU       | RU*      | R
Financeiro      | RCUDX     | RCUDX  | RCUD  | R         | R*       | —
Agenda          | RCUD      | RCUD   | RCUD  | RCUD      | RCUD     | R
Equipe/Membros  | RCUD      | RCUD   | RCUD  | R         | —        | —
Integrações     | RCUD      | RCUD   | RCUD  | R         | —        | —
Marketplace     | RCUD      | RCUD   | RCUD  | RCUD      | RCUD     | R
Anúncios (Meta) | RCUD      | RCUD   | RCUD  | R         | R        | —
Dev Dashboard   | RCUD      | R      | —     | —         | —        | —
Admin Global    | RCUDX     | —      | —     | —         | —        | —

* = Apenas registros próprios (broker_id = auth.uid())
```

### 4.2 Enforcement Atual vs Ideal

| Nível | Estado Atual | Gap |
|-------|-------------|-----|
| Banco (RLS) | ✅ Enforced por `has_role()` + `get_user_organization_id()` | S3, S5 precisam fix |
| Edge Functions | ⚠️ Inconsistente — 14 funções sem nenhuma auth | S1, S2, S8 |
| Frontend | ⚠️ Apenas UI gating — insuficiente como barreira de segurança | Esperado — UX only |
| Custom Roles | ✅ `organization_custom_roles` com `module_permissions` | Não enforced no RLS |

---

## 5. Multi-tenant e Isolamento

### 5.1 Estado Atual

| Aspecto | Implementação | Status |
|---------|--------------|--------|
| Isolamento por org | `get_user_organization_id()` em RLS | ✅ Forte |
| `SECURITY DEFINER` para evitar recursão | `has_role()`, `is_org_admin()`, etc. | ✅ Correto |
| Session variables para performance | `get_user_organization_id()` cacheado | ✅ Otimizado |
| Storage isolation | Path-based (`{org_id}/...`) | ✅ Implementado |
| Marketplace cross-tenant | `marketplace_properties_public` view SECURITY DEFINER | ✅ Strip PII |
| Edge Functions tenant isolation | Via JWT → query profile → org_id | ⚠️ Inconsistente |

### 5.2 Gaps de Isolamento

| # | Gap | Risco |
|---|-----|-------|
| **M1** | `user_roles` sem `organization_id` — roles são globais | Usuário com `admin` em org A mantém `admin` ao aceitar convite de org B (mitigado: `accept_organization_invite` faz DELETE + INSERT) |
| **M2** | `admin_allowlist` é global (sem org) — correto por design | OK — superadmin global |
| **M3** | `lead_stages` pode ter `organization_id = NULL` — stages "globais" | Org pode ver/editar stages de outra org se RLS não filtrar NULL |
| **M4** | Sem audit trail por tenant no `audit_events` | ✅ Já tem `organization_id` — OK |

---

## 6. Backlog Técnico Priorizado

```
FASE 1 — CORREÇÕES CRÍTICAS DE SEGURANÇA (Semana 1, ~10h)
[ ] S1   Rate limit + captcha no send-reset-email ............ 2h [P0]
[ ] S3   Fix user_roles UPDATE policy — developer-only ....... 1h [P0]
[ ] S5   Restringir campos editáveis em profiles UPDATE ...... 1h [P0]
[ ] S6   Remover comparação direta de service key ............ 1h [P0]
[ ] S8   Adicionar auth check em crm-import-leads ............ 1h [P0]
[ ] S2   Adicionar auth check em onesignal-app-id ............ 0.5h [P0]
[ ]      Audit log no admin-users (DELETE e PATCH) ........... 2h [P0]
[ ] S7   Validar state param nos OAuth callbacks ............. 1.5h [P0]

FASE 2 — SESSÃO E AUDITORIA (Semana 2-3, ~12h)
[ ] S12  Implementar logout global (signOut scope: 'global') . 1h [P1]
[ ]      Invalidar sessões ao trocar senha ................... 2h [P1]
[ ]      Log de login/logout em audit_events ................. 2h [P1]
[ ]      Log de login falho (Edge Function wrapper) .......... 2h [P1]
[ ]      Rate limiting genérico para Edge Functions .......... 3h [P1]
[ ]      Re-autenticação para ações sensíveis (trocar email) . 2h [P2]

FASE 3 — ISOLAMENTO E PERMISSÕES FINAS (Semana 4-5, ~10h)
[ ] M3   Adicionar check NOT NULL em lead_stages RLS ......... 1h [P1]
[ ]      Enforce custom_roles.module_permissions no RLS ....... 4h [P2]
[ ]      Adicionar organization_id ao user_roles (breaking) .. 3h [P3]
[ ]      MFA opcional para admins ............................ 2h [P3]

TOTAL: ~32h em 5 semanas
```

---

## 7. Ordem Segura de Implementação

### Passo 1 — Corrigir Brechas de Escalonamento (Sem breaking changes)

**S3 — Fix user_roles UPDATE policy:**
```sql
-- Apenas developer pode fazer UPDATE em roles
DROP POLICY IF EXISTS "Dev or admin can update roles" ON user_roles;
CREATE POLICY "Only developers can update roles" ON user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'developer'))
  WITH CHECK (has_role(auth.uid(), 'developer'));
```

**S5 — Restringir campos editáveis em profiles:**
```sql
-- Trigger para bloquear auto-verificação
CREATE OR REPLACE FUNCTION prevent_self_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id = auth.uid() THEN
    -- Usuário editando próprio perfil: preservar campos sensíveis
    NEW.email_verified := OLD.email_verified;
    NEW.phone_verified := OLD.phone_verified;
    NEW.creci_verified := OLD.creci_verified;
    NEW.creci_verified_at := OLD.creci_verified_at;
    NEW.creci_verified_name := OLD.creci_verified_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prevent_self_verification
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_verification();
```

### Passo 2 — Rate Limit no `send-reset-email`

```typescript
// Adicionar no início da função:
const ip = req.headers.get("x-forwarded-for") || "unknown";
const rateLimitKey = `reset:${email}:${ip}`;

// Verificar no banco se houve chamada nos últimos 60s
const { count } = await supabaseAdmin
  .from("audit_events")
  .select("id", { count: "exact", head: true })
  .eq("action", "password.reset_requested")
  .eq("entity_name", email.toLowerCase())
  .gte("created_at", new Date(Date.now() - 60_000).toISOString());

if (count && count > 0) {
  // Responder 200 para não revelar rate limit
  return new Response(JSON.stringify({ success: true }), { ... });
}
```

### Passo 3 — Audit Log em `admin-users`

```typescript
// Após sucesso de DELETE ou PATCH:
await adminClient.from("audit_events").insert({
  action: req.method === "DELETE" ? "user.deleted_by_admin" : "user.password_reset_by_admin",
  action_category: "security",
  entity_type: "user",
  entity_id: targetUserId,
  user_id: user.id,
  risk_level: "critical",
  source: "edge_function",
  status: "success",
});
```

### Passo 4 — Auth Check em Funções Expostas

```typescript
// onesignal-app-id: Adicionar verificação mínima
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, ... });
}
// Verificar token via getClaims
```

---

## 8. Resumo Executivo

### ✅ Pontos Fortes
- RLS em 100% das tabelas com funções SECURITY DEFINER bem projetadas
- `is_system_admin()` via `admin_allowlist` — padrão robusto para superadmin
- Trigger `audit_role_changes` — auditoria automática de mudanças de role
- `handle_new_user` — provisionamento atômico (org + profile + role)
- `accept_organization_invite` — troca de org com cleanup de roles
- Profile UPDATE protege contra mudança de `organization_id`
- RLS INSERT em `user_roles` com anti-escalação (developer-only para roles elevadas)

### ❌ Pontos Críticos
- **14 Edge Functions com `verify_jwt=false` sem auth interna** — maior superfície de ataque
- **`send-reset-email` sem rate limit** — abuso trivial
- **`user_roles` UPDATE policy permite admin escalar para developer** — escalonamento de privilégio
- **Campos de verificação em profiles editáveis pelo próprio usuário** — auto-verificação
- **Zero auditoria em ações admin (delete user, reset password)** — operações destrutivas invisíveis
- **Sem MFA, sem logout global, sem invalidação por troca de senha**

### Princípio guia
> **"O RLS é a barreira real; o frontend é apenas UX."**
> Toda autorização que existe apenas no frontend é uma sugestão, não uma regra.
> Edge Functions sem auth são portas abertas — mesmo com `verify_jwt=false`, validação interna é obrigatória.

---

*Auditoria gerada por análise de RLS policies, Edge Functions, triggers, auth context e funções SECURITY DEFINER em 2026-03-23.*
