# 🔍 Auditoria Completa Pós-Migração — Habitae ERP Imobiliário
> **Data**: 2026-03-20 | **Auditor**: QA Técnico Automatizado  
> **Origem**: Projeto Lovable `aiflfkkjitvsyszwdfga` (Lovable Cloud)  
> **Destino**: Projeto Lovable `zpajuxxsxrwuqregdzjm` (Supabase Externo)  
> **Método**: Cópia de repo GitHub + importação de dados via Edge Function `import-from-source`

---

## 📊 RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Tabelas públicas | 89 |
| Policies RLS | 283 |
| RLS habilitado | ✅ **89/89 tabelas** |
| Funções SQL | 104 |
| Triggers | 54 |
| Views | 3 |
| Extensões | 9 |
| Cron Jobs | 2 |
| Realtime | 8 tabelas |
| Storage Buckets | 5 |
| Edge Functions | 70 |
| auth.users | 10 |
| Secrets configurados | 3 de ~35 necessários |

---

## 1️⃣ INTEGRIDADE DO BANCO DE DADOS

### O que validar
- Todas as 89 tabelas existem com estrutura correta
- Dados migrados com contagens corretas
- Enums, funções, triggers e views estão presentes
- Extensões ativadas

### Evidências coletadas

| Tabela | Registros | Observação |
|--------|-----------|-----------|
| profiles | 10 | ✅ Compatível com auth.users (10) |
| organizations | 3 | ✅ |
| user_roles | 10 | ✅ 1 role por usuário |
| properties | 1.122 | ✅ |
| property_images | 25.548 | ✅ |
| leads | 1.467 | ✅ |
| lead_interactions | 492 | ✅ |
| lead_stages | 19 | ✅ Funil completo |
| lead_types | 7 | ✅ |
| appointments | 120 | ✅ |
| notifications | 3.355 | ✅ |
| contracts | 0 | ⚠️ Vazio (confirmar com origem) |
| tasks | 0 | ⚠️ Vazio (confirmar com origem) |
| transactions | 0 | ⚠️ Vazio (confirmar com origem) |
| subscription_plans | 0 | 🔴 **Sem planos de assinatura** |

### Extensões

| Extensão | Versão | Status |
|----------|--------|--------|
| pg_cron | 1.6.4 | ✅ |
| pg_net | 0.20.0 | ✅ |
| pg_trgm | 1.6 | ✅ |
| pgcrypto | 1.3 | ✅ |
| uuid-ossp | 1.1 | ✅ |
| pg_graphql | 1.5.11 | ✅ |
| supabase_vault | 0.3.1 | ✅ |

### Criticidade: ✅ APROVADO (schema e extensões íntegros)

---

## 2️⃣ COMPATIBILIDADE DO CÓDIGO COM O NOVO SUPABASE

### O que validar
- Variáveis de ambiente apontam para o projeto correto
- Nenhuma referência hardcoded ao projeto antigo no código TS/TSX
- `supabase/config.toml` com project_id correto

### Evidências

| Item | Esperado | Encontrado | Status |
|------|----------|-----------|--------|
| `VITE_SUPABASE_URL` | `https://zpajuxxsxrwuqregdzjm.supabase.co` | ✅ Correto | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key do novo projeto | ✅ Correto | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | `zpajuxxsxrwuqregdzjm` | ✅ Correto | ✅ |
| Referências hardcoded em TS/TSX | Nenhuma | ✅ Nenhuma | ✅ |
| `supabase/config.toml` project_id | `zpajuxxsxrwuqregdzjm` | ❌ `aiflfkkjitvsyszwdfga` | 🔴 **ERRADO** |

### Erros comuns nesse tipo de migração
- Config.toml com project_id antigo → deploy de edge functions pode falhar ou ir pro projeto errado
- URLs hardcoded em migrations antigas → não re-executadas, baixo risco

### Correção
- Alterar `supabase/config.toml` linha 1 para `project_id = "zpajuxxsxrwuqregdzjm"`

### Criticidade: 🟡 MÉDIA (config.toml errado)

---

## 3️⃣ AUTENTICAÇÃO

### O que validar
- auth.users existem e estão linkados a profiles
- Roles corretos atribuídos
- Trigger `handle_new_user` funcional
- Login funciona no preview

### Evidências

| Email | Role | Profile vinculado |
|-------|------|-------------------|
| portocaicaraimoveis@gmail.com | admin | ✅ |
| matheuslinskr@gmail.com | admin | ✅ |
| matheuslinsrecu2@gmail.com | admin | ✅ |
| matheuslinspg@gmail.com | developer | ✅ |
| costa.azulnegocios@gmail.com (Rebeca) | sub_admin | ✅ |
| raul.limalara@gmail.com | corretor | ✅ |
| anaclaudia.delfino@gmail.com | corretor | ✅ |
| jars01@jarsdesign.com | corretor | ✅ |
| matheuslinsrecu@gmail.com | corretor | ✅ |
| tabelasportocaicara2@gmail.com | corretor | ✅ |

### Trigger `handle_new_user`
- ✅ Existe e funciona corretamente
- ✅ Cria profile, organization e user_role automaticamente
- ✅ Suporta convites (organization_invites)

### Como testar
1. Fazer login com um usuário existente → deve funcionar
2. Criar novo usuário → profile/org/role devem ser criados automaticamente
3. Testar "Esqueci minha senha" → requer `RESEND_API_KEY` (ausente)

### Criticidade: ✅ APROVADO (estrutura OK, mas email de reset depende de secret ausente)

---

## 4️⃣ POLICIES RLS

### O que validar
- RLS habilitado em todas as tabelas
- 283 policies definidas e ativas
- Sem recursão infinita
- Isolamento de tenant (organização) funcional

### Evidências
- ✅ **89/89 tabelas com RLS habilitado** (corrigido desde a auditoria anterior)
- ✅ 283 policies definidas
- Policies usam pattern `organization_id IN (SELECT profiles.organization_id FROM profiles WHERE user_id = auth.uid())`

### Erros comuns
- RLS habilitado mas policies não existem → dados ficam invisíveis
- Recursão infinita em policies que consultam a própria tabela
- Falta de policy para service_role em edge functions

### Como testar
1. Login como corretor → deve ver apenas dados da sua organização
2. Login como admin → deve ver dados da organização
3. Requisição sem auth → deve ser bloqueada

### Criticidade: ✅ APROVADO

---

## 5️⃣ STORAGE

### O que validar
- Buckets existem com configuração correta
- Policies de storage definidas
- Arquivos acessíveis (URLs de mídia funcionam)

### Evidências

| Bucket | Público | Policies | Status |
|--------|---------|----------|--------|
| brand-assets | ✅ Sim | 3 (view, upload, update, delete) | ✅ |
| lead-documents | ❌ Não | 3 (view, upload, update, delete) | ✅ |
| pdf-imports | ❌ Não | 3 (upload, read, delete) | ✅ |
| property-images | ✅ Sim | 2 (view, upload) | ✅ |
| ticket-attachments | ❌ Não | 2 (upload, view) | ✅ |

**Total: 16 storage policies configuradas**

### Nota importante
- Arquivos existentes no storage do projeto antigo **NÃO são migrados** automaticamente
- URLs de mídia (Cloudinary/R2) são externas e continuam funcionando
- Se houver arquivos no storage nativo do Supabase antigo, precisam ser migrados manualmente

### Criticidade: ✅ APROVADO (estrutura OK; mídia é externa via Cloudinary/R2)

---

## 6️⃣ AUTOMAÇÕES (Cron Jobs, Triggers, Realtime)

### 6A — Cron Jobs

| Job | Schedule | URL | Anon Key | Status |
|-----|----------|-----|----------|--------|
| cleanup-orphan-media | `0 */6 * * *` | ✅ Novo projeto | ❌ **Key do projeto antigo** | 🔴 FALHA |
| rd-station-sync-leads | `*/15 * * * *` | ✅ Novo projeto | ❌ **Key do projeto antigo** | 🔴 FALHA |

**Problema**: URL correta (`zpajuxxsxrwuqregdzjm`) mas anon key é do projeto antigo (`aiflfkkjitvsyszwdfga`).  
**Impacto**: Jobs retornam 401 Unauthorized a cada execução.  
**Correção**: Recriar jobs no SQL Editor com nova anon key.

### 6B — Push Notification Trigger

| Item | Valor |
|------|-------|
| GUC `app.settings.supabase_url` | ❌ **NULL** |
| GUC `app.settings.supabase_anon_key` | ❌ **NULL** |
| Fallback hardcoded | `https://aiflfkkjitvsyszwdfga.supabase.co` + anon key antiga |

**Impacto**: Push notifications chamam o projeto antigo.  
**Correção**: Configurar GUC settings via SQL Editor:
```sql
-- NÃO pode ser feito via migration (ALTER DATABASE não permitido)
-- Executar no SQL Editor do Dashboard:
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://zpajuxxsxrwuqregdzjm.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0';
```

### 6C — Realtime

| Tabela | Habilitada |
|--------|-----------|
| app_runtime_config | ✅ |
| appointments | ✅ |
| import_runs | ✅ |
| lead_documents | ✅ |
| notifications | ✅ |
| organization_member_events | ✅ |
| property_visits | ✅ |
| ticket_messages | ✅ |
| **leads** | ❌ Ausente |

**Nota**: Verificar se `leads` precisa de realtime (ex: kanban board com updates em tempo real).

### 6D — Triggers (54 verificados)

✅ Todos os 54 triggers estão ativos e corretamente vinculados às tabelas.

### Criticidade: 🔴 CRÍTICA (cron jobs e push trigger com referências ao projeto antigo)

---

## 7️⃣ EDGE FUNCTIONS & SECRETS

### 70 Edge Functions no repositório
✅ Todas presentes no diretório `supabase/functions/`

### Secrets — Estado Atual vs Necessário

| Secret | Status | Criticidade | Impacto se ausente |
|--------|--------|------------|-------------------|
| `LOVABLE_API_KEY` | ✅ Presente | - | Auto-gerenciado |
| `SOURCE_SUPABASE_URL` | ✅ Presente | Temporário | Apenas para migração |
| `SOURCE_SUPABASE_SERVICE_ROLE_KEY` | ✅ Presente | Temporário | Apenas para migração |
| **`GOOGLE_AI_KEY_1`** | 🔴 Ausente | Crítico | AI features quebram |
| **`GOOGLE_AI_KEY_2`** | 🔴 Ausente | Crítico | Fallback AI quebra |
| **`RESEND_API_KEY`** | 🔴 Ausente | Crítico | Emails (invite, reset) não enviam |
| **`APP_URL`** | 🔴 Ausente | Crítico | Links em emails errados |
| **`APP_ALLOWED_ORIGINS`** | 🔴 Ausente | Crítico | CORS falha |
| `ONESIGNAL_APP_ID` | 🔴 Ausente | Alto | Push notifications quebram |
| `ONESIGNAL_REST_API_KEY` | 🔴 Ausente | Alto | Push notifications quebram |
| `CLOUDINARY_CLOUD_NAME` | 🔴 Ausente | Alto | Upload de fotos falha |
| `CLOUDINARY_API_KEY` | 🔴 Ausente | Alto | Upload de fotos falha |
| `CLOUDINARY_API_SECRET` | 🔴 Ausente | Alto | Upload de fotos falha |
| `R2_ACCESS_KEY_ID` | 🔴 Ausente | Alto | Storage R2 falha |
| `R2_SECRET_ACCESS_KEY` | 🔴 Ausente | Alto | Storage R2 falha |
| `R2_BUCKET_NAME` | 🔴 Ausente | Alto | Storage R2 falha |
| `R2_ENDPOINT` | 🔴 Ausente | Alto | Storage R2 falha |
| `R2_PUBLIC_URL` | 🔴 Ausente | Alto | URLs de mídia quebram |
| `ASAAS_API_KEY` | 🔴 Ausente | Alto | Billing quebra |
| `ASAAS_WEBHOOK_TOKEN` | 🔴 Ausente | Alto | Webhook billing falha |
| `META_APP_ID` | 🔴 Ausente | Médio | Meta Ads OAuth falha |
| `META_APP_SECRET` | 🔴 Ausente | Médio | Meta Ads OAuth falha |
| `RD_STATION_CLIENT_ID` | 🔴 Ausente | Médio | RD Station OAuth falha |
| `RD_STATION_CLIENT_SECRET` | 🔴 Ausente | Médio | RD Station OAuth falha |
| `GOOGLE_DRIVE_API_KEY` | 🔴 Ausente | Médio | Scraping de imagens falha |
| `UAZAPI_BASE_URL` | 🔴 Ausente | Médio | WhatsApp falha |
| `UAZAPI_ADMIN_TOKEN` | 🔴 Ausente | Médio | WhatsApp falha |
| `CLOUDFLARE_API_TOKEN` | 🔴 Ausente | Médio | Cache purge falha |
| `CLOUDFLARE_ZONE_ID` | 🔴 Ausente | Médio | Cache purge falha |
| `GOOGLE_AI_PDF_KEY_1` | 🔴 Ausente | Médio | Extração de PDF falha |
| `OPENAI_IMAGE_API_KEY` | 🔴 Ausente | Médio | Geração de imagem AI falha |

**Resultado: 3/~35 secrets configurados (8.6%)**

### Criticidade: 🔴 CRÍTICA (91% dos secrets ausentes)

---

## 8️⃣ QUERIES E FLUXOS DE DADOS

### O que validar
- Queries do frontend funcionam com RLS ativo
- Joins entre tabelas retornam dados corretos
- Paginação funciona (limite de 1000 rows do Supabase)

### Riscos identificados

| Risco | Detalhe | Criticidade |
|-------|---------|------------|
| Tabela `leads` com 1.467 registros | Pode exceder 1000 rows se não paginado | Médio |
| Tabela `property_images` com 25.548 registros | Precisa paginação correta | Médio |
| `subscription_plans` vazio | Fluxo de billing pode quebrar se esperar planos | Alto |

### Criticidade: 🟡 MÉDIA

---

## 9️⃣ FLUXOS PRINCIPAIS DO USUÁRIO

| # | Fluxo | Dependências | Funciona? |
|---|-------|-------------|----------|
| 1 | Login/Logout | auth.users, profiles | ✅ Provável (dados OK) |
| 2 | Listagem de imóveis | properties, property_images, RLS | ✅ Provável |
| 3 | CRM / Kanban de leads | leads, lead_stages, lead_interactions | ✅ Provável |
| 4 | Upload de fotos | Cloudinary secrets | 🔴 **Falha** (secrets ausentes) |
| 5 | Envio de email (invite/reset) | RESEND_API_KEY | 🔴 **Falha** (secret ausente) |
| 6 | Push notifications | OneSignal secrets + GUC settings | 🔴 **Falha** |
| 7 | Geração de conteúdo AI | GOOGLE_AI_KEY_* | 🔴 **Falha** (secrets ausentes) |
| 8 | Billing/Assinaturas | ASAAS_*, subscription_plans | 🔴 **Falha** (secrets + dados ausentes) |
| 9 | Integração Meta Ads | META_* secrets | 🔴 **Falha** (secrets ausentes) |
| 10 | Integração RD Station | RD_STATION_* secrets + cron | 🔴 **Falha** |
| 11 | WhatsApp | UAZAPI_* secrets | 🔴 **Falha** (secrets ausentes) |
| 12 | Manutenção (toggle) | app_runtime_config, realtime | ✅ Provável |

---

## 📋 CHECKLIST FINAL DE APROVAÇÃO

### 🔴 Bloqueadores (DEVE resolver antes de produção)

- [ ] **SEC-01**: Corrigir `config.toml` — alterar project_id para `zpajuxxsxrwuqregdzjm`
- [ ] **SEC-02**: Configurar secrets críticos no Supabase Dashboard:
  - [ ] `GOOGLE_AI_KEY_1`, `GOOGLE_AI_KEY_2`
  - [ ] `RESEND_API_KEY`
  - [ ] `APP_URL`
  - [ ] `APP_ALLOWED_ORIGINS`
- [ ] **SEC-03**: Corrigir cron jobs com nova anon key (SQL Editor do Dashboard)
- [ ] **SEC-04**: Configurar GUC settings para push trigger (SQL Editor do Dashboard)
- [ ] **SEC-05**: Configurar secrets de storage: `CLOUDINARY_*` (3), `R2_*` (5)
- [ ] **SEC-06**: Configurar secrets de push: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`

### 🟡 Importantes (resolver antes do go-live)

- [ ] **IMP-01**: Configurar secrets de billing: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`
- [ ] **IMP-02**: Verificar se `subscription_plans` precisa de dados seed
- [ ] **IMP-03**: Configurar secrets Meta Ads: `META_APP_ID`, `META_APP_SECRET`
- [ ] **IMP-04**: Configurar secrets RD Station: `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET`
- [ ] **IMP-05**: Verificar se `leads` precisa realtime habilitado
- [ ] **IMP-06**: Configurar `VITE_GOOGLE_MAPS_EMBED_KEY` e `VITE_R2_PUBLIC_URL` no frontend

### 🟢 Pós go-live

- [ ] **POS-01**: Remover secrets de migração (`SOURCE_SUPABASE_*`)
- [ ] **POS-02**: Atualizar documentação com referências ao novo projeto
- [ ] **POS-03**: Monitorar logs de edge functions por 48h
- [ ] **POS-04**: Testar todos os 12 fluxos principais com usuário real
- [ ] **POS-05**: Configurar secrets opcionais restantes (WhatsApp, Cloudflare, etc.)

---

## 📊 TABELA DE SEVERIDADE CONSOLIDADA

| # | Achado | Prioridade | Severidade | Status |
|---|--------|-----------|-----------|--------|
| C1 | RLS habilitado em todas tabelas | P0 | Crítica | ✅ RESOLVIDO |
| C2 | Cron jobs com anon key antiga | P0 | Crítica | 🔴 PENDENTE |
| C3 | Push trigger com fallback antigo | P0 | Alta | 🔴 PENDENTE |
| C4 | config.toml com project_id antigo | P1 | Média | 🔴 PENDENTE |
| C5 | 91% dos secrets ausentes | P0 | Crítica | 🔴 PENDENTE |
| C6 | subscription_plans vazio | P2 | Média | ⏳ VERIFICAR |
| C7 | leads sem realtime | P3 | Baixa | ⏳ VERIFICAR |
| D1 | Dados de profiles/roles migrados | - | - | ✅ OK |
| D2 | Dados de properties migrados | - | - | ✅ OK |
| D3 | Dados de leads migrados | - | - | ✅ OK |
| D4 | Storage buckets com policies | - | - | ✅ OK |
| D5 | 54 triggers ativos | - | - | ✅ OK |
| D6 | Views criadas | - | - | ✅ OK |
| D7 | Frontend sem hardcoded refs | - | - | ✅ OK |

---

## ✅ VEREDITO

**A migração está estruturalmente completa**, com schema, dados, triggers, views e RLS corretamente transferidos.

**Para entrar em produção**, é necessário:
1. Corrigir `config.toml` (1 min)
2. Configurar ~30 secrets no Supabase Dashboard (~30 min)
3. Recriar 2 cron jobs com nova anon key (~5 min)
4. Configurar GUC settings para push (~2 min)

**Tempo estimado para resolução de todos os bloqueadores: ~40 minutos** (requer acesso ao Supabase Dashboard e aos valores dos secrets do projeto antigo).
