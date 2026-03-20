# 🔍 Auditoria Pós-Migração — Habitae ERP Imobiliário
> **Data**: 2026-03-20  
> **Origem**: Projeto `aiflfkkjitvsyszwdfga` (Lovable Cloud)  
> **Destino**: Projeto `zpajuxxsxrwuqregdzjm` (Supabase Externo)  
> **Método**: Cópia de repositório GitHub + importação SQL via Edge Function  

---

## 🚨 ACHADOS CRÍTICOS (Ação Imediata)

### C1 — RLS DESABILITADO EM TODAS AS 89 TABELAS

| Item | Detalhe |
|------|---------|
| **O que foi encontrado** | `relrowsecurity = false` em **todas as 89 tabelas**, apesar de existirem **283 policies** definidas |
| **Como verificar** | `SELECT tablename FROM pg_tables t JOIN pg_class c ON t.tablename = c.relname WHERE t.schemaname = 'public' AND c.relrowsecurity = false` |
| **Impacto** | 🔴 **MÁXIMO** — Qualquer usuário autenticado pode ler/escrever qualquer dado de qualquer organização. Sem isolamento de tenant. |
| **Sinal de problema** | Usuário A vê dados do Usuário B; qualquer chamada `supabase.from('tabela').select()` retorna TODOS os dados |
| **Correção** | Executar `ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY` para cada tabela que já possui policies |
| **Prioridade** | 🔴 P0 — Bloqueador de produção |

### C2 — pg_cron jobs com anon key do PROJETO ANTIGO

| Item | Detalhe |
|------|---------|
| **O que foi encontrado** | 2 cron jobs ativos usando URL correta (`zpajuxxsxrwuqregdzjm`) mas com **anon key do projeto antigo** (`aiflfkkjitvsyszwdfga`) |
| **Jobs afetados** | `cleanup-orphan-media` (6/6h) e `rd-station-sync-leads` (15/15min) |
| **Impacto** | 🔴 **ALTO** — Jobs falham com 401 Unauthorized a cada execução |
| **Sinal** | Logs da edge function sem requisições; limpeza de mídia órfã não executa |
| **Correção** | Recriar jobs com a nova anon key via SQL Editor |

### C3 — Trigger `trigger_push_on_notification` com fallback para projeto antigo

| Item | Detalhe |
|------|---------|
| **O que foi encontrado** | Fallback hardcoded: `https://aiflfkkjitvsyszwdfga.supabase.co` e anon key do projeto antigo |
| **GUC settings** | `app.settings.supabase_url` = NULL, `app.settings.supabase_anon_key` = NULL |
| **Impacto** | 🔴 **ALTO** — Push notifications chamam o projeto antigo (que pode não existir mais) |
| **Correção** | Configurar GUC settings OU atualizar a função para usar o URL correto |

### C4 — `supabase/config.toml` com project_id antigo

| Item | Detalhe |
|------|---------|
| **O que foi encontrado** | `project_id = "aiflfkkjitvsyszwdfga"` no config.toml |
| **Impacto** | 🟡 **MÉDIO** — Pode causar confusão no deploy de edge functions e no CLI |
| **Correção** | Alterar para `project_id = "zpajuxxsxrwuqregdzjm"` |

---

## 📊 INVENTÁRIO DO BANCO MIGRADO

### Tabelas e Dados

| Recurso | Quantidade |
|---------|-----------|
| Tabelas públicas | 89 |
| Policies RLS | 283 (todas **inativas**) |
| Funções SQL | 104 |
| Triggers | 54 |
| Views | 3 (`marketplace_properties_public`, `profiles_public`, `users`) |
| Extensões | 9 (pg_cron, pg_net, pg_trgm, pgcrypto, uuid-ossp...) |
| Cron jobs | 2 |
| Realtime tables | 8 |
| Storage buckets | 5 |
| Edge Functions | 70 |

### Contagem de Dados Críticos

| Tabela | Registros |
|--------|-----------|
| profiles | 10 |
| organizations | 3 |
| user_roles | 10 |
| properties | 1.122 |
| property_images | 25.548 |
| leads | 1.467 |
| lead_interactions | 492 |
| appointments | 120 |
| notifications | 3.355 |
| contracts | 0 |
| tasks | 0 |
| transactions | 0 |

---

## 📋 CHECKLIST DE VALIDAÇÃO POR ÁREA

### 1. Autenticação

| # | Validação | Como testar | Status |
|---|-----------|-------------|--------|
| 1.1 | Usuários existem em `auth.users` | Dashboard → Auth → Users | ⏳ Verificar |
| 1.2 | Perfis linkados a `auth.users` | `SELECT p.user_id, a.email FROM profiles p JOIN auth.users a ON a.id = p.user_id` | ⏳ |
| 1.3 | Login funciona | Testar login no preview | ⏳ |
| 1.4 | Roles corretos | `SELECT u.email, r.role FROM user_roles r JOIN auth.users u ON u.id = r.user_id` | ⏳ |
| 1.5 | Reset de senha funciona | Testar fluxo "Esqueci minha senha" | ⏳ |

### 2. Variáveis de Ambiente

| # | Variável | Valor esperado | Status |
|---|----------|---------------|--------|
| 2.1 | `VITE_SUPABASE_URL` | `https://zpajuxxsxrwuqregdzjm.supabase.co` | ✅ Correto |
| 2.2 | `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key do novo projeto | ✅ Correto |
| 2.3 | `VITE_SUPABASE_PROJECT_ID` | `zpajuxxsxrwuqregdzjm` | ✅ Correto |
| 2.4 | Referências hardcoded no código TS/TSX | Nenhuma referência ao projeto antigo | ✅ Limpo |

### 3. Schema & Estrutura

| # | Validação | Status |
|---|-----------|--------|
| 3.1 | 89 tabelas criadas | ✅ |
| 3.2 | 104 funções SQL | ✅ |
| 3.3 | 54 triggers ativos | ✅ |
| 3.4 | 3 views criadas | ✅ |
| 3.5 | Extensões (pg_cron, pg_net, pg_trgm) | ✅ |
| 3.6 | Enums corretos | ⏳ Verificar |

### 4. RLS / Policies

| # | Validação | Status |
|---|-----------|--------|
| 4.1 | RLS habilitado nas tabelas | 🔴 **FALHA — DESABILITADO EM TODAS** |
| 4.2 | 283 policies existem | ✅ Existem |
| 4.3 | Policies funcionam corretamente | 🔴 Não testável até RLS habilitado |

### 5. Storage Buckets

| # | Bucket | Existe | Policies |
|---|--------|--------|----------|
| 5.1 | `brand-assets` | ✅ | ⏳ Verificar |
| 5.2 | `lead-documents` | ✅ | ⏳ |
| 5.3 | `pdf-imports` | ✅ | ⏳ |
| 5.4 | `property-images` | ✅ | ⏳ |
| 5.5 | `ticket-attachments` | ✅ | ⏳ |

### 6. Realtime

| # | Tabela | Habilitada |
|---|--------|-----------|
| 6.1 | `app_runtime_config` | ✅ |
| 6.2 | `appointments` | ✅ |
| 6.3 | `import_runs` | ✅ |
| 6.4 | `lead_documents` | ✅ |
| 6.5 | `notifications` | ✅ |
| 6.6 | `organization_member_events` | ✅ |
| 6.7 | `property_visits` | ✅ |
| 6.8 | `ticket_messages` | ✅ |
| ⚠️ | `leads` | ❌ **AUSENTE** (era realtime na origem?) |

### 7. Edge Functions & Secrets

| # | Validação | Status |
|---|-----------|--------|
| 7.1 | 70 edge functions no repo | ✅ |
| 7.2 | `LOVABLE_API_KEY` disponível | ✅ (auto-gerenciado) |
| 7.3 | `SOURCE_SUPABASE_URL` | ✅ (migração) |
| 7.4 | `SOURCE_SUPABASE_SERVICE_ROLE_KEY` | ✅ (migração) |
| 7.5 | `GOOGLE_AI_KEY_1` / `_2` | 🔴 **AUSENTE** |
| 7.6 | `RESEND_API_KEY` | 🔴 **AUSENTE** |
| 7.7 | `ONESIGNAL_APP_ID` / `REST_API_KEY` | 🔴 **AUSENTE** |
| 7.8 | `CLOUDINARY_*` (3 vars) | 🔴 **AUSENTE** |
| 7.9 | `R2_*` (5 vars) | 🔴 **AUSENTE** |
| 7.10 | `ASAAS_API_KEY` / `WEBHOOK_TOKEN` | 🔴 **AUSENTE** |
| 7.11 | `META_APP_ID` / `SECRET` | 🔴 **AUSENTE** |
| 7.12 | `RD_STATION_*` (2 vars) | 🔴 **AUSENTE** |
| 7.13 | `APP_URL` | 🔴 **AUSENTE** |
| 7.14 | `APP_ALLOWED_ORIGINS` | 🔴 **AUSENTE** |

### 8. Cron Jobs

| # | Job | Schedule | Status |
|---|-----|----------|--------|
| 8.1 | `cleanup-orphan-media` | `0 */6 * * *` | 🔴 Anon key errada |
| 8.2 | `rd-station-sync-leads` | `*/15 * * * *` | 🔴 Anon key errada |

### 9. Referências Hardcoded

| # | Arquivo | Referência | Status |
|---|---------|-----------|--------|
| 9.1 | `supabase/config.toml` | `project_id = "aiflfkkjitvsyszwdfga"` | 🔴 Errado |
| 9.2 | `supabase/migrations/` (3 arquivos) | URL e anon key do antigo | ⚠️ Histórico (não re-executado) |
| 9.3 | `docs/` (3 arquivos) | Referências documentais | ⚠️ Cosmético |
| 9.4 | Código TS/TSX | Nenhuma referência | ✅ Limpo |

---

## 📊 TABELA CONSOLIDADA DE AÇÕES

| # | Achado | Prioridade | Severidade | Evidência | Status | Correção |
|---|--------|-----------|-----------|-----------|--------|----------|
| C1 | RLS desabilitado (89 tabelas) | 🔴 P0 | Crítica | `relrowsecurity = false` em todas | 🔴 ABERTO | Migration SQL para habilitar RLS |
| C2 | Cron jobs com anon key antiga | 🔴 P0 | Alta | Jobs retornam 401 | 🔴 ABERTO | Recriar com nova key |
| C3 | Push trigger com fallback antigo | 🔴 P1 | Alta | GUC settings = NULL | 🔴 ABERTO | Configurar GUC ou atualizar função |
| C4 | config.toml com project_id antigo | 🟡 P2 | Média | Arquivo no repo | 🔴 ABERTO | Editar arquivo |
| C5 | 30+ secrets ausentes | 🔴 P0 | Crítica | Apenas 3 secrets configurados | 🔴 ABERTO | Adicionar via Supabase Dashboard |
| C6 | `leads` sem realtime | 🟡 P2 | Média | Ausente da publication | ⏳ Verificar se necessário |
| C7 | Storage bucket policies | 🟡 P2 | Média | Não verificado | ⏳ Verificar |

---

## 🛠️ PLANO DE CORREÇÃO PRIORITÁRIO

### Imediato (antes de qualquer uso em produção)

1. **Habilitar RLS** em todas as 89 tabelas
2. **Adicionar secrets** críticos (ver `SECRETS_MIGRATION_CHECKLIST.md`)
3. **Corrigir cron jobs** com nova anon key
4. **Configurar GUC settings** para push notifications

### Curto prazo (antes do go-live)

5. Atualizar `config.toml` com project_id correto
6. Verificar storage bucket policies
7. Adicionar `leads` ao realtime (se necessário)
8. Testar fluxos: login, listagem, CRM, upload, push

### Pós go-live

9. Remover secrets de migração (`SOURCE_*`)
10. Atualizar documentação com referências ao novo projeto
11. Monitorar logs por 48h

---

## ✅ O QUE ESTÁ CORRETO

- ✅ 89 tabelas com dados migrados
- ✅ 104 funções SQL + 54 triggers + 3 views
- ✅ Extensões (pg_cron, pg_net, pg_trgm, pgcrypto, uuid-ossp)
- ✅ 5 storage buckets criados
- ✅ 8 tabelas com realtime habilitado
- ✅ Frontend sem referências hardcoded ao projeto antigo
- ✅ Variáveis VITE_* corretas no .env
- ✅ 70 edge functions no repositório
- ✅ Dados de profiles, properties, leads, appointments migrados
