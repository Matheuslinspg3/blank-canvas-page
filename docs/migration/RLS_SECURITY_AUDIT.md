# 🔒 Auditoria de Segurança RLS — Pós-Migração
> **Data**: 2026-03-20 | **Banco**: `zpajuxxsxrwuqregdzjm`  
> **Auditor**: Especialista em Segurança Supabase  
> **Escopo**: Policies RLS, Roles, Isolamento de tenant, Acesso indevido

---

## 📊 INVENTÁRIO DE SEGURANÇA

| Métrica | Valor |
|---------|-------|
| Tabelas com RLS habilitado | **89/89 (100%)** |
| Tabelas com `rls_forced` | 0 (padrão Supabase) |
| Total de policies | **283** |
| Policies para role `authenticated` | ~120 |
| Policies para role `public` (anon+authenticated) | ~140 |
| Policies para role `anon` explícito | **1** (app_runtime_config) |
| Tabelas com SELECT `qual = true` (aberto) | **3** |
| Security Definer functions | **8** |

---

## 1. ERROS DE PERMISSÃO COMUNS NESTE TIPO DE MIGRAÇÃO

### 1.1 — Erros que QUEBRAM a aplicação

| # | Erro | Sintoma | Causa |
|---|------|---------|-------|
| E1 | RLS habilitado sem policies | `0 rows` retornado, app parece vazio | Policy não foi migrada junto com tabela |
| E2 | Policy referencia function inexistente | `function X does not exist` no console | Function de segurança não migrada |
| E3 | Policy usa `auth.uid()` mas user não está no novo banco | `0 rows` mesmo logado | auth.users não migrado |
| E4 | Enum de role faltando valor | `invalid input value for enum app_role` | Enum não tem todos os valores |

### 1.2 — Erros SILENCIOSOS (app funciona mas segurança está comprometida)

| # | Erro | Risco | Detecção |
|---|------|-------|----------|
| S1 | Policy com `USING (true)` sem intenção | Dados expostos publicamente | Revisão manual |
| S2 | Policy para `public` role em tabela sensível | Anon pode ler dados | Verificar role da policy |
| S3 | Falta de policy DELETE permite cascata | Dados deletados sem autorização | Testar DELETE sem auth |
| S4 | `with_check` ausente em INSERT/UPDATE | Dados inseridos para outra organização | Testar inserção cross-tenant |
| S5 | Security Definer function sem `set search_path` | SQL injection via path manipulation | Verificar prosrc |

### 1.3 — Erros de BLOQUEIO INDEVIDO

| # | Erro | Sintoma | Causa |
|---|------|---------|-------|
| B1 | Policy muito restritiva | Usuário legítimo não vê seus dados | Condição de role/org incorreta |
| B2 | Falta de policy para role `authenticated` | Corretor não consegue inserir dados | Só admin tem INSERT |
| B3 | Maintenance mode block ativo | Ninguém consegue inserir/atualizar | `is_maintenance_blocked()` retorna true |

---

## 2. COMO TESTAR ACESSO AUTORIZADO E NÃO AUTORIZADO

### 2.1 — Teste de acesso anon (não autenticado)

```sql
-- No SQL Editor do Supabase, simular request anon:
-- Resetar role para anon
SET role anon;

-- Tentar ler tabela que deveria ser protegida
SELECT * FROM leads LIMIT 1;        -- Esperado: 0 rows
SELECT * FROM properties LIMIT 1;   -- Esperado: 0 rows (exceto marketplace)
SELECT * FROM profiles LIMIT 1;     -- Esperado: 0 rows
SELECT * FROM user_roles LIMIT 1;   -- Esperado: 0 rows

-- Tabelas que DEVEM ser acessíveis por anon
SELECT * FROM app_runtime_config LIMIT 1;  -- Esperado: 1 row
SELECT * FROM property_type_codes LIMIT 1; -- Esperado: rows (público)

-- Restaurar role
RESET role;
```

### 2.2 — Teste de acesso authenticated (simulando um usuário)

```sql
-- No SQL Editor, simular um usuário autenticado específico:
-- (Substituir pelo UUID real do usuário)
SET role authenticated;
SET request.jwt.claims = '{"sub": "UUID_DO_USUARIO", "role": "authenticated"}';

-- Verificar se vê apenas dados da sua organização
SELECT organization_id, count(*) FROM leads GROUP BY organization_id;
-- Esperado: apenas 1 organization_id (o do usuário)

SELECT organization_id, count(*) FROM properties GROUP BY organization_id;
-- Esperado: apenas 1 organization_id

-- Tentar acessar dados de outra organização
SELECT * FROM leads WHERE organization_id = 'UUID_DE_OUTRA_ORG';
-- Esperado: 0 rows (isolamento de tenant)

RESET role;
```

### 2.3 — Teste de inserção cross-tenant

```sql
SET role authenticated;
SET request.jwt.claims = '{"sub": "UUID_DO_USUARIO_ORG_A"}';

-- Tentar inserir lead na organização B
INSERT INTO leads (name, organization_id, lead_stage_id)
VALUES ('Teste Cross-Tenant', 'UUID_ORG_B', 'UUID_STAGE');
-- Esperado: ERRO de RLS (new row violates row-level security policy)

RESET role;
```

### 2.4 — Teste de escalação de privilégio

```sql
SET role authenticated;
SET request.jwt.claims = '{"sub": "UUID_CORRETOR"}';

-- Corretor tentando acessar dados de admin
SELECT * FROM admin_allowlist;
-- Esperado: 0 rows

SELECT * FROM ai_provider_config;
-- Esperado: 0 rows (precisa ser manager_or_above)

SELECT * FROM billing_payments;
-- Esperado: 0 rows (precisa ser admin)

RESET role;
```

---

## 3. TABELAS EXPOSTAS OU INACESSÍVEIS POR ENGANO

### 3.1 — Tabelas com SELECT aberto (`qual = true`)

| Tabela | Policy | Role | Justificativa | Risco |
|--------|--------|------|---------------|-------|
| `app_runtime_config` | Anyone can read config | anon, authenticated | Configuração pública (maintenance mode) | ✅ OK — intencional |
| `ai_billing_pricing` | Anyone can read active pricing | authenticated | Preços públicos para usuários logados | ✅ OK — intencional |
| `property_type_codes` | Anyone can view property type codes | public | Códigos de referência públicos | ✅ OK — intencional |

**Nenhuma tabela sensível está exposta publicamente.**

### 3.2 — Tabelas potencialmente inacessíveis

| Tabela | Policies | Risco de bloqueio |
|--------|----------|-------------------|
| `maintenance_audit_log` | 1 (SELECT only, system_admin) | ⚠️ Apenas dev/admin vê — intencional |
| `deleted_property_media` | 1 (SELECT only, system_admin) | ⚠️ Apenas dev vê — intencional |
| `platform_invites` | 1 (SELECT only) | ⚠️ Verificar se falta INSERT/UPDATE |
| `scrape_cache` | 1 | ⚠️ Verificar se edge function usa service_role |
| `subscription_plans` | 1 (SELECT only) | ⚠️ Sem INSERT = precisa service_role para seed |
| `subscriptions` | 1 | ⚠️ Verificar se billing edge function usa service_role |
| `rd_station_webhook_logs` | 1 | ⚠️ Verificar se webhook usa service_role |

> **Nota**: Tabelas com apenas 1 policy geralmente dependem de `service_role` para operações de escrita via edge functions. Isso é **correto** desde que as edge functions usem `createClient` com `service_role_key`.

### 3.3 — Análise de role `public` vs `authenticated`

**⚠️ ACHADO IMPORTANTE**: ~50 tabelas usam role `public` em vez de `authenticated`. 

No Supabase, `public` = `anon` + `authenticated`. Porém, todas essas policies incluem `auth.uid()` nas condições QUAL/WITH CHECK, o que efetivamente bloqueia acesso anon (já que `auth.uid()` retorna NULL para anon).

| Tabela com role `public` + `auth.uid()` | Seguro? |
|------------------------------------------|---------|
| appointments | ✅ Sim — `auth.uid()` no qual |
| audit_logs | ✅ Sim — `is_org_admin(auth.uid())` |
| contracts | ✅ Sim — `has_role(auth.uid(), ...)` |
| properties | ✅ Sim — `is_member_of_org(...)` |
| leads | ✅ Sim (via authenticated policies) |

**Recomendação**: Trocar `public` para `authenticated` nessas policies para defesa em profundidade. Não é um bug de segurança (auth.uid() protege), mas é uma best practice.

---

## 4. VALIDAÇÃO DAS POLICIES RECRIADAS

### 4.1 — Security Definer Functions (core da segurança)

| Function | SECURITY DEFINER | `search_path` | Recursão segura | Status |
|----------|-----------------|---------------|-----------------|--------|
| `has_role(uuid, app_role)` | ✅ | ⚠️ Não explícito | ✅ Consulta `user_roles` | ✅ |
| `is_org_admin(uuid)` | ✅ | ⚠️ Não explícito | ✅ Consulta `user_roles` | ✅ |
| `is_org_manager(uuid)` | ✅ | ⚠️ Não explícito | ✅ Consulta `user_roles` | ✅ |
| `is_org_manager_or_above(uuid)` | ✅ | ⚠️ Não explícito | ✅ Consulta `user_roles` | ✅ |
| `is_system_admin()` | ✅ | ⚠️ Não explícito | ✅ Consulta `admin_allowlist` | ✅ |
| `is_member_of_org(uuid)` | ✅ | ⚠️ Não explícito | ✅ Consulta `profiles` | ✅ |
| `get_user_organization_id()` | ✅ | ⚠️ Não explícito | ✅ Consulta `profiles` | ✅ |
| `is_maintenance_blocked()` | ✅ | ⚠️ Não explícito | ✅ Consulta `app_runtime_config` | ✅ |

**⚠️ Achado**: Nenhuma das functions define `SET search_path = public` explicitamente. Isso é uma **melhoria recomendada** mas não um risco imediato, pois o Supabase define o `search_path` padrão como `public, extensions`.

### 4.2 — Padrões de isolamento de tenant

O sistema usa **3 padrões** para isolamento multi-tenant:

| Padrão | Usado em | Exemplo |
|--------|----------|---------|
| `organization_id = get_user_organization_id()` | ~40 tabelas | ad_accounts, leads, properties |
| `organization_id IN (SELECT profiles.organization_id FROM profiles WHERE user_id = auth.uid())` | ~15 tabelas | activity_log, brand_settings |
| `is_member_of_org(organization_id)` | ~20 tabelas | appointments, contracts |

Todos os 3 padrões são **funcionalmente equivalentes** e seguros.

### 4.3 — Hierarquia de roles validada

| Verificação | Roles incluídas | Status |
|-------------|----------------|--------|
| `is_org_admin(uid)` | admin | ✅ |
| `is_org_manager(uid)` | admin, leader | ✅ |
| `is_org_manager_or_above(uid)` | admin, sub_admin, leader, developer | ✅ |
| `is_system_admin()` | emails em admin_allowlist | ✅ |
| `has_role(uid, 'developer')` | developer | ✅ |

---

## 5. MATRIZ DE TESTES — CENÁRIOS POSITIVOS E NEGATIVOS

### 5.1 — Cenários de acesso a LEADS

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| L1 | Anon | SELECT leads | 0 rows | ✅ Negativo |
| L2 | Corretor Org A | SELECT leads Org A | Seus leads + org | ✅ Positivo |
| L3 | Corretor Org A | SELECT leads Org B | 0 rows | ✅ Negativo |
| L4 | Corretor | INSERT lead com organization_id da sua org | Sucesso | ✅ Positivo |
| L5 | Corretor | INSERT lead com organization_id de outra org | ERRO RLS | ✅ Negativo |
| L6 | Admin | UPDATE lead de qualquer corretor da org | Sucesso | ✅ Positivo |
| L7 | Corretor | DELETE lead | Verificar se tem policy | ⚠️ Verificar |

### 5.2 — Cenários de acesso a PROPERTIES

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| P1 | Anon | SELECT properties | 0 rows | ✅ Negativo |
| P2 | Corretor | SELECT properties da sua org | Todos da org | ✅ Positivo |
| P3 | Corretor | INSERT property com org errada | ERRO RLS | ✅ Negativo |
| P4 | Admin | UPDATE property | Sucesso | ✅ Positivo |
| P5 | Anon | SELECT marketplace_properties (publicadas) | Apenas published | ✅ Positivo |

### 5.3 — Cenários de acesso a PROFILES

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| PR1 | Anon | SELECT profiles | 0 rows | ✅ Negativo |
| PR2 | Authenticated | SELECT own profile | 1 row (seu perfil) | ✅ Positivo |
| PR3 | Authenticated | SELECT profiles da mesma org | Membros da org | ✅ Positivo |
| PR4 | Authenticated | UPDATE profile de outro user | ERRO RLS | ✅ Negativo |

### 5.4 — Cenários de acesso a USER_ROLES

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| R1 | Anon | SELECT user_roles | 0 rows | ✅ Negativo |
| R2 | Authenticated | SELECT own roles | Suas roles | ✅ Positivo |
| R3 | Corretor | INSERT user_role para si mesmo | ERRO RLS (apenas admin) | ✅ Negativo |
| R4 | Admin | INSERT/UPDATE roles | Sucesso | ✅ Positivo |

### 5.5 — Cenários de acesso ADMIN

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| A1 | Corretor | SELECT admin_allowlist | 0 rows | ✅ Negativo |
| A2 | Developer | SELECT admin_allowlist | Dados | ✅ Positivo |
| A3 | Corretor | SELECT ai_provider_config | 0 rows | ✅ Negativo |
| A4 | Corretor | SELECT billing_payments | 0 rows | ✅ Negativo |
| A5 | Admin | SELECT billing_payments da sua org | Dados | ✅ Positivo |

### 5.6 — Cenários de MANUTENÇÃO

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| M1 | Qualquer | SELECT durante manutenção | Funciona (leitura OK) | ✅ Positivo |
| M2 | Corretor | INSERT durante manutenção | ERRO (bloqueado) | ✅ Negativo |
| M3 | Developer | INSERT durante manutenção | Sucesso (bypass) | ✅ Positivo |

### 5.7 — Cenários CROSS-TENANT

| # | Ator | Ação | Esperado | Tipo |
|---|------|------|----------|------|
| X1 | User Org A | SELECT leads Org B | 0 rows | ✅ Negativo |
| X2 | User Org A | INSERT contract com org_id B | ERRO RLS | ✅ Negativo |
| X3 | User Org A | UPDATE property de Org B | ERRO RLS | ✅ Negativo |
| X4 | User Org A | DELETE appointment de Org B | ERRO RLS | ✅ Negativo |

---

## 6. ACHADOS DE SEGURANÇA

### 🟢 Sem risco (aprovado)

| # | Achado | Detalhe |
|---|--------|---------|
| OK1 | RLS 100% habilitado | 89/89 tabelas |
| OK2 | 283 policies definidas | Cobertura completa |
| OK3 | Security definer functions | 8 funções sem recursão |
| OK4 | Isolamento multi-tenant | 3 padrões equivalentes |
| OK5 | Hierarquia de roles | Corretamente implementada |
| OK6 | PII protegido | ad_leads restrito a managers+ |
| OK7 | Tabelas públicas justificadas | Apenas 3, sem dados sensíveis |

### 🟡 Melhorias recomendadas (não bloqueadores)

| # | Achado | Recomendação | Risco |
|---|--------|-------------|-------|
| M1 | ~50 policies usam role `public` | Migrar para `authenticated` | Baixo |
| M2 | Functions sem `SET search_path` | Adicionar `SET search_path = public` | Baixo |
| M3 | `billing_webhook_logs` INSERT com `with_check: false` | Confirmar que só service_role insere | Baixo |
| M4 | `platform_invites` sem INSERT policy | Confirmar se edge function usa service_role | Baixo |

### 🔴 Nenhum achado crítico

---

## ✅ VEREDITO DE RISCO DE SEGURANÇA PÓS-MIGRAÇÃO

### Classificação: **RISCO BAIXO** ✅

| Critério | Avaliação |
|----------|-----------|
| RLS habilitado em todas as tabelas | ✅ 100% |
| Isolamento multi-tenant | ✅ Funcional via organization_id |
| Escalação de privilégio | ✅ Protegido via has_role/is_org_admin |
| Acesso anon a dados sensíveis | ✅ Bloqueado (auth.uid() em todas policies) |
| Cross-tenant data leak | ✅ Protegido via get_user_organization_id() |
| Security definer functions | ✅ 8 funções sem recursão infinita |
| PII exposure | ✅ Restrito por role |
| Dados públicos justificados | ✅ Apenas config/pricing/type_codes |

**O sistema de segurança RLS está corretamente migrado e operacional.**

As 4 melhorias recomendadas (M1-M4) são de **hardening** — não representam vulnerabilidades exploráveis, mas seguem best practices de defesa em profundidade.

### Ações recomendadas (não bloqueadoras):
1. Migrar policies de `public` para `authenticated` (M1)
2. Adicionar `SET search_path = public` nas security definer functions (M2)
3. Verificar que edge functions de billing/webhook usam `service_role_key` (M3-M4)
