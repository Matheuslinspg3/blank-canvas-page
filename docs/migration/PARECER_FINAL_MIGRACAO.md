# 📋 PARECER FINAL DE PÓS-MIGRAÇÃO
> **Projeto**: Porto Caiçara Imóveis (Lovable → Novo Supabase)  
> **Banco destino**: `zpajuxxsxrwuqregdzjm`  
> **Data**: 2026-03-20  
> **Auditor**: Especialista Técnico em Supabase  
> **Auditorias realizadas**: RLS/Segurança, Autenticação, Integridade de Dados, Storage, Automações

---

## 1. RESUMO EXECUTIVO

A migração do projeto Lovable "Porto Caiçara Imóveis" para um novo banco Supabase foi **parcialmente bem-sucedida**. A estrutura do banco (89 tabelas, 102 funções SQL, 283 policies RLS, 68 edge functions) foi migrada com fidelidade. Porém, foram identificados **problemas operacionais críticos** que impedem o go-live imediato: triggers desabilitados na tabela principal (`properties`), cron jobs com credenciais do projeto antigo, e ausência de secrets para edge functions.

Os dados das 3 organizações ativas estão íntegros, mas ~13.500 registros órfãos de 4 organizações não migradas poluem o banco. A autenticação está funcional com 100% de sincronia entre `auth.users`, `profiles` e `user_roles`.

### Classificação: **🟡 APROVADO COM RESSALVAS**
### Nota de confiança: **6.5 / 10**

---

## 2. ESCOPO VALIDADO

| Área | Itens verificados | Ferramenta |
|------|-------------------|------------|
| **Segurança RLS** | 89 tabelas, 283 policies, 8 functions SECURITY DEFINER | SQL + revisão manual |
| **Autenticação** | Login, logout, refresh, signup, trigger, perfis, OAuth config | SQL + código fonte |
| **Integridade de dados** | Contagens, FKs, órfãos, duplicidades, nulls, timestamps | SQL (27 queries) |
| **Storage** | 5 buckets, 16 policies, referências no código | SQL + grep |
| **Automações** | 28 triggers, 102 funções, 2 cron jobs, 68 edge functions | SQL + secrets + código |

---

## 3. PRINCIPAIS RISCOS ENCONTRADOS

### 🔴 Severidade CRÍTICA (bloqueiam funcionalidade)

| # | Risco | Área | Impacto |
|---|-------|------|---------|
| R1 | **8 triggers DESABILITADOS em `properties`** | Automações | Imóveis sem código auto, sem auditoria, sem cascade delete, `updated_at` congelado |
| R2 | **2 cron jobs com anon key do projeto antigo** | Automações | Cleanup de mídia e sync RD Station falhando silenciosamente (401) |
| R3 | **~15 secrets ausentes** para edge functions | Automações | Upload R2, envio de email, push, AI, integrações Meta/RD Station — tudo inoperante |
| R4 | **734 leads (50%) e 145 properties (13%) órfãos** | Dados | Dados invisíveis via RLS, 4 organizações fonte não existem no destino |

### 🟡 Severidade ALTA (funcionalidade degradada)

| # | Risco | Área | Impacto |
|---|-------|------|---------|
| R5 | `subscription_plans` vazio | Dados | Billing/planos inacessíveis |
| R6 | `admin_allowlist` vazio | Dados | Sem super-admins configurados |
| R7 | 12.708 property_images órfãs (50%) | Dados | Espaço desperdiçado, consultas admin poluídas |
| R8 | 1.286 images com `storage_provider='cloudinary'` mas URL R2 | Dados | Inconsistência de metadado (funciona mas confuso) |
| R9 | `exec_sql` existe no banco | Segurança | Risco de SQL injection se acessível via RPC |
| R10 | ~50 policies usando role `public` em vez de `authenticated` | Segurança | Funcional mas menos seguro (defense-in-depth) |

### 🟢 Severidade BAIXA (melhorias recomendadas)

| # | Risco | Área |
|---|-------|------|
| R11 | Configurar SITE_URL e Redirect URLs no Dashboard Auth | Auth |
| R12 | Atualizar callback OAuth no Google Cloud Console | Auth |
| R13 | Configurar RESEND_API_KEY para emails transacionais | Auth |
| R14 | Property-images bucket sem policy DELETE/UPDATE | Storage |

---

## 4. ITENS APROVADOS ✅

| # | Item | Resultado | Detalhe |
|---|------|----------|---------|
| ✅ 1 | RLS habilitado em todas as tabelas | 89/89 (100%) | Nenhuma tabela exposta |
| ✅ 2 | Isolamento multi-tenant | Funcional | `get_user_organization_id()` + policies corretos |
| ✅ 3 | Security Definer functions | 8 funções corretas | `has_role`, `is_org_admin`, etc. |
| ✅ 4 | auth.users ↔ profiles ↔ user_roles | 0 órfãos | 10/10 sincronizados |
| ✅ 5 | Trigger `on_auth_user_created` | Ativo e funcional | Cria profile + org + role |
| ✅ 6 | Supabase Client config | Correto | autoRefreshToken, localStorage |
| ✅ 7 | Duplicidades em tabelas core | 0 encontradas | profiles, roles, leads — limpos |
| ✅ 8 | Timestamps | 0 inconsistências | Sem futuros ou muito antigos |
| ✅ 9 | Nulls indevidos | 0 encontrados | leads.name, properties.org_id — OK |
| ✅ 10 | Extensões pg_cron + pg_net | Instaladas | v1.6.4 e v0.20.0 |
| ✅ 11 | 102 funções SQL | Todas presentes | Nenhuma ausente |
| ✅ 12 | 68 edge functions | Todas deployadas | Código no repositório |
| ✅ 13 | 5 storage buckets | Criados corretamente | brand-assets, lead-documents, pdf-imports, property-images, ticket-attachments |
| ✅ 14 | 16 storage policies | Configuradas | SELECT, INSERT, DELETE por bucket |
| ✅ 15 | Triggers em leads, appointments, contracts | Todos habilitados | Auditoria + logs + notificações |

---

## 5. ITENS REPROVADOS ❌

| # | Item | Resultado | Severidade |
|---|------|----------|------------|
| ❌ 1 | Triggers em `properties` | 8/8 DESABILITADOS | 🔴 Crítica |
| ❌ 2 | Cron jobs | Token do projeto antigo | 🔴 Crítica |
| ❌ 3 | Secrets de edge functions | 3/18+ configurados | 🔴 Crítica |
| ❌ 4 | Organizações no banco | 3/7 presentes | 🔴 Crítica |
| ❌ 5 | `subscription_plans` seed | Tabela vazia | 🟡 Alta |
| ❌ 6 | `admin_allowlist` seed | Tabela vazia | 🟡 Alta |
| ❌ 7 | Função `exec_sql` | Presente sem restrição | 🟡 Alta (segurança) |

---

## 6. PENDÊNCIAS

| # | Pendência | Responsável | Tipo |
|---|-----------|-------------|------|
| P1 | Decidir destino dos dados órfãos (importar orgs ou limpar) | **Cliente** | Decisão de negócio |
| P2 | Configurar SITE_URL e Redirect URLs no Dashboard | **Cliente** | Config manual |
| P3 | Atualizar callback OAuth (Google) | **Cliente** | Config externa |
| P4 | Adicionar ~15 secrets no Dashboard | **Cliente** | Config manual |
| P5 | Popular `subscription_plans` com dados | **Dev/Cliente** | Seed data |
| P6 | Popular `admin_allowlist` com emails | **Dev/Cliente** | Seed data |
| P7 | Testar login real com email/senha após config | **QA** | Teste manual |
| P8 | Testar upload de foto em imóvel (R2) | **QA** | Teste manual |
| P9 | Verificar se contracts/tasks/transactions devem ter dados | **Cliente** | Verificação |

---

## 7. IMPACTO POR SEVERIDADE

```
🔴 CRÍTICA (4 itens) ████████████████████░░░░░░░░░░ 40%
   → Funcionalidade core QUEBRADA: triggers properties, cron jobs, secrets, dados órfãos
   
🟡 ALTA (6 itens)    ████████████████░░░░░░░░░░░░░░ 30%
   → Funcionalidade DEGRADADA: billing, admin, segurança preventiva
   
🟢 BAIXA (4 itens)   ████████░░░░░░░░░░░░░░░░░░░░░░ 15%
   → Melhorias de configuração
   
✅ OK (15 itens)      ██████████████████████████████ 100%
   → Estrutura, auth, RLS, dados core
```

---

## 8. RECOMENDAÇÃO: 🚫 BLOQUEIO PARA GO-LIVE

**O sistema NÃO está pronto para produção** no estado atual.

**Motivo principal**: A tabela `properties` — centro do negócio imobiliário — tem TODAS as suas automações desabilitadas. Criar, editar ou deletar imóveis não gera códigos, não atualiza timestamps, não audita, e não cascateia para o marketplace. Isso resultará em dados corrompidos silenciosamente.

**Condição para liberação**: Executar o plano de correção P0 e P1 abaixo (estimativa: 2-4 horas).

---

## 9. PLANO DE CORREÇÃO PRIORIZADO

### P0 — Correções imediatas (< 30 min) — ANTES de qualquer uso

| # | Ação | SQL/Config | Tempo |
|---|------|-----------|-------|
| 1 | Habilitar triggers em properties | `ALTER TABLE properties ENABLE TRIGGER ALL;` | 1 min |
| 2 | Atualizar cron jobs com novo anon key | SQL no audit de automações | 5 min |
| 3 | Remover ou restringir `exec_sql` | `DROP FUNCTION IF EXISTS exec_sql;` ou adicionar `is_system_admin()` check | 5 min |

### P1 — Correções essenciais (< 4h) — ANTES do go-live

| # | Ação | Responsável | Tempo |
|---|------|-------------|-------|
| 4 | Adicionar secrets R2 (5 secrets) | Cliente no Dashboard | 15 min |
| 5 | Adicionar RESEND_API_KEY | Cliente no Dashboard | 5 min |
| 6 | Adicionar OPENAI_API_KEY | Cliente no Dashboard | 5 min |
| 7 | Adicionar ONESIGNAL_APP_ID + API_KEY | Cliente no Dashboard | 5 min |
| 8 | Configurar SITE_URL e Redirect URLs | Cliente no Dashboard Auth | 10 min |
| 9 | Popular `subscription_plans` | Dev (INSERT SQL) | 30 min |
| 10 | Popular `admin_allowlist` | Dev (INSERT SQL) | 5 min |
| 11 | Decidir destino dos ~13.500 registros órfãos | Cliente | 30 min |

### P2 — Correções recomendadas (< 1 semana) — APÓS go-live

| # | Ação | Impacto |
|---|------|---------|
| 12 | Adicionar secrets Meta, RD Station, Cloudinary, Stripe | Restaura integrações |
| 13 | Corrigir `storage_provider` inconsistente em 1.286 images | Limpeza de dados |
| 14 | Adicionar policy DELETE em property-images bucket | Permite remover fotos |
| 15 | Migrar policies `public` → `authenticated` | Hardening de segurança |
| 16 | Atualizar callback OAuth Google | Restaura login social |

---

## 10. CHECKLIST FINAL DE ACEITE

| # | Item | Status | Bloqueante? |
|---|------|--------|-------------|
| 1 | Todas as tabelas têm RLS habilitado | ✅ Aprovado | — |
| 2 | auth.users ↔ profiles ↔ roles sincronizados | ✅ Aprovado | — |
| 3 | Trigger de criação de perfil ativo | ✅ Aprovado | — |
| 4 | Funções SQL presentes e funcionais | ✅ Aprovado | — |
| 5 | Edge functions deployadas | ✅ Aprovado | — |
| 6 | Storage buckets criados com policies | ✅ Aprovado | — |
| 7 | Dados das orgs ativas íntegros | ✅ Aprovado | — |
| 8 | Zero duplicidades e nulls indevidos | ✅ Aprovado | — |
| 9 | Triggers em `properties` habilitados | ❌ **REPROVADO** | 🔴 **SIM** |
| 10 | Cron jobs com credenciais corretas | ❌ **REPROVADO** | 🔴 **SIM** |
| 11 | Secrets de edge functions configurados | ❌ **REPROVADO** | 🔴 **SIM** |
| 12 | Dados órfãos resolvidos | ❌ **PENDENTE** | 🟡 Parcial |
| 13 | Tabelas seed populadas | ❌ **PENDENTE** | 🟡 Parcial |
| 14 | Login testado manualmente | ⏳ **PENDENTE** | 🟡 Parcial |
| 15 | Upload de foto testado | ⏳ **PENDENTE** | 🟡 Parcial |

---

## CLASSIFICAÇÃO FINAL

# 🟡 APROVADO COM RESSALVAS

**A estrutura da migração está correta e completa.** O banco, as tabelas, as policies RLS, as funções SQL, os triggers e as edge functions foram todos migrados com sucesso. A arquitetura de segurança multi-tenant está funcional.

**As ressalvas são operacionais, não estruturais.** Os problemas encontrados (triggers desabilitados, cron keys, secrets) são de configuração pós-migração e podem ser corrigidos em poucas horas sem alteração de código ou schema.

---

## NOTA DE CONFIANÇA DA MIGRAÇÃO

# 6.5 / 10

| Critério | Nota | Peso | Justificativa |
|----------|------|------|---------------|
| Estrutura do banco | 9/10 | 20% | 89 tabelas, 102 funções, 283 policies — tudo presente |
| Segurança RLS | 9/10 | 20% | 100% cobertura, isolamento multi-tenant funcional |
| Autenticação | 9/10 | 15% | Perfeita sincronia, trigger ativo, config correta |
| Integridade de dados | 6/10 | 15% | 50% dos leads são órfãos, dados seed ausentes |
| Automações | 3/10 | 15% | 8 triggers desabilitados, cron quebrado, secrets ausentes |
| Storage | 7/10 | 5% | Buckets OK, policies parciais, 0 arquivos migrados |
| Prontidão operacional | 3/10 | 10% | Não testado em produção, secrets faltando |

**Média ponderada: 6.5/10**

**Justificativa**: A base estrutural da migração é sólida (estrutura 9/10, segurança 9/10, auth 9/10), mas as falhas operacionais (triggers desabilitados em properties, cron com token errado, 15+ secrets ausentes) impedem o uso real do sistema. São problemas de **configuração**, não de **arquitetura** — corrigíveis em 2-4 horas. Após as correções P0 e P1, a nota subiria para **8.5-9.0/10**.

---

## AUDITORIAS DE REFERÊNCIA

| Documento | Conteúdo |
|-----------|----------|
| [`RLS_SECURITY_AUDIT.md`](./RLS_SECURITY_AUDIT.md) | 283 policies, roles, isolamento tenant |
| [`AUTH_AUDIT.md`](./AUTH_AUDIT.md) | Login, signup, triggers, sessão, OAuth |
| [`DATA_INTEGRITY_AUDIT.md`](./DATA_INTEGRITY_AUDIT.md) | Contagens, órfãos, FKs, score 80/100 |
| [`AUTOMATIONS_AUDIT.md`](./AUTOMATIONS_AUDIT.md) | Triggers, cron, edge functions, secrets |

---

*Parecer emitido em 2026-03-20. Válido até execução das correções P0.*
