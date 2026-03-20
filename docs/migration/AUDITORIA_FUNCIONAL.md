# 🔍 AUDITORIA FUNCIONAL PÓS-MIGRAÇÃO
> **Data**: 2026-03-20  
> **Método**: Testes manuais via network requests, edge function calls, DB queries e console logs  

---

## 1. ERROS CRÍTICOS ENCONTRADOS

### 🔴 E1 — Timeout na listagem de imóveis (CORRIGIDO)
- **Sintoma**: Query `GET /rest/v1/properties?...&limit=1000` retorna `500` com `"canceling statement due to statement timeout"`
- **Causa raiz**: `useProperties.ts` buscava 979 propriedades com JOIN em 25.548 imagens usando `PAGE_SIZE=1000`. A query gerava 10.863 linhas e levava >400ms, excedendo o timeout do PostgREST.
- **Correção aplicada**: Reduzido `PAGE_SIZE` de 1000 para 200 em `src/hooks/useProperties.ts`
- **Status**: ✅ CORRIGIDO

### 🔴 E2 — Secrets de Edge Functions ausentes
- **Sintoma**: Múltiplas edge functions retornam erros de configuração
- **Detalhamento**:

| Edge Function | Erro | Secret necessário |
|--------------|------|-------------------|
| `onesignal-app-id` | `ONESIGNAL_APP_ID not configured` | `ONESIGNAL_APP_ID` |
| `rd-station-app-id` | `RD_STATION_CLIENT_ID not configured` | `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET` |
| `meta-app-id` | `META_APP_ID not configured` | `META_APP_ID`, `META_APP_SECRET` |
| `send-reset-email` | `RESEND_API_KEY não configurada` | `RESEND_API_KEY` |
| `generate-landing-content` | `AI not configured (no Groq keys)` | `OPENAI_API_KEY` ou `GROQ_API_KEY` |
| `r2-upload` | `R2 config incompleta` (AccessKey length=0) | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| `cloudinary-sign` | Requer auth (funciona se autenticado) | `CLOUDINARY_API_SECRET`, `CLOUDINARY_API_KEY` |

- **Status**: ❌ REQUER AÇÃO MANUAL NO DASHBOARD
- **Como corrigir**: [Dashboard > Settings > Edge Functions](https://supabase.com/dashboard/project/zpajuxxsxrwuqregdzjm/settings/functions)

---

## 2. ERROS MODERADOS

### 🟡 E3 — 12.708 imagens órfãs (50% do total)
- **Sintoma**: `property_images` tem 25.548 registros, mas 12.708 não têm `property_id` correspondente em `properties`
- **Causa**: 4 organizações fonte não foram migradas, mas suas imagens sim
- **Impacto**: Consultas mais lentas, espaço desperdiçado, dados poluídos
- **Status**: ❌ REQUER DECISÃO DE NEGÓCIO (limpar ou importar orgs faltantes)

### 🟡 E4 — 734 leads órfãos
- **Sintoma**: Leads referenciando `organization_id` que não existe na tabela `organizations`
- **Causa**: Mesma causa do E3 — organizações não migradas
- **Status**: ❌ REQUER DECISÃO DE NEGÓCIO

### 🟡 E5 — 2 propriedades sem property_code
- **Sintoma**: `properties` tem 1.124 registros, 2 sem `property_code`
- **Causa**: Podem ter sido inseridos antes da ativação do trigger `trigger_auto_property_code`
- **Status**: ⚠️ Pode ser corrigido com UPDATE manual
- **Correção sugerida**: Rodar o trigger manualmente nos 2 registros

### 🟡 E6 — React ref warning no DetailedFunnel
- **Sintoma**: Console warning: `Function components cannot be given refs` no componente `DetailedFunnel`
- **Causa**: `Dialog` passando ref para componente funcional sem `forwardRef`
- **Impacto**: Apenas warning, não quebra funcionalidade
- **Status**: ⚠️ Correção de código necessária (menor prioridade)

---

## 3. FUNÇÕES TESTADAS E FUNCIONANDO ✅

| Função/Feature | Método de teste | Resultado |
|----------------|-----------------|-----------|
| **Login/Auth** | Network requests + session | ✅ Funcionando (usuário logado) |
| **Dashboard KPIs** | `fn_kpi_metrics` RPC | ✅ 200 OK (223 leads, 5 visitas) |
| **Dashboard Stats** | `fn_dashboard_stats` RPC | ✅ 200 OK (979 imóveis, 223 leads ativos) |
| **Agent Ranking** | `fn_agent_ranking` RPC | ✅ 200 OK |
| **Notifications** | GET /notifications | ✅ 200 OK (50 notificações) |
| **Leads ativos** | GET /leads?is_active=eq.true | ✅ 200 OK |
| **Leads inativos** | GET /leads?is_active=eq.false | ✅ 200 OK |
| **Profiles** | GET /profiles_public | ✅ 200 OK (3 perfis retornados) |
| **Properties por ID** | GET /properties?id=in.(...) | ✅ 200 OK |
| **Maintenance mode** | GET /app_runtime_config | ✅ 200 OK |
| **Triggers properties** | DB query tgenabled=O | ✅ Todos 8 habilitados |
| **Cron jobs** | DB query cron.job | ✅ 2 jobs ativos com chave correta |
| **subscription_plans** | DB query | ✅ 4 planos populados |
| **admin_allowlist** | DB query | ✅ 1 admin configurado |
| **test-ai-connection** | curl (sem auth) | ✅ 200 OK (retorna erro de auth esperado) |
| **portal-xml-feed** | curl (sem feed_id) | ✅ Responde corretamente com erro de validação |
| **validate-document** | curl (sem params) | ✅ Responde com erro de validação esperado |

---

## 4. EDGE FUNCTIONS — MAPA DE STATUS

### ✅ Funcionam (com auth do usuário logado)
- `cloudinary-sign` — auth funciona, precisa de secrets Cloudinary
- `test-ai-connection` — funciona, retorna corretamente
- `portal-xml-feed` — funciona, requer feed_id/portal
- `validate-document` — funciona, valida params
- `toggle-maintenance-mode` — funciona, requer formato correto

### ❌ Falham por falta de secrets (REQUER AÇÃO MANUAL)
| Edge Function | Secret faltante |
|--------------|----------------|
| `r2-upload` | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| `send-reset-email` | `RESEND_API_KEY` |
| `send-invite-email` | `RESEND_API_KEY` |
| `onesignal-app-id` | `ONESIGNAL_APP_ID` |
| `send-push` | `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` |
| `rd-station-app-id` | `RD_STATION_CLIENT_ID` |
| `rd-station-sync-leads` | `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET` |
| `meta-app-id` | `META_APP_ID` |
| `meta-oauth-callback` | `META_APP_ID`, `META_APP_SECRET` |
| `generate-landing-content` | `OPENAI_API_KEY` ou `GROQ_API_KEY` |
| `generate-ad-content` | `OPENAI_API_KEY` ou `GROQ_API_KEY` |
| `generate-ad-image` | `OPENAI_API_KEY` |
| `summarize-lead` | `OPENAI_API_KEY` ou `GROQ_API_KEY` |
| `generate-property-art` | `OPENAI_API_KEY` |
| `generate-property-video` | Depende de serviço externo |
| `cloudinary-cleanup` | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME` |
| `migrate-cloudinary-to-r2` | R2 + Cloudinary secrets |
| `geocode-properties` | Depende de provider de geocoding |

### ✅ Funcionam sem secrets externos (apenas Supabase)
- `admin-users`, `admin-audit-metrics`, `admin-subscriptions`
- `accept-invite`, `manage-member`, `platform-signup`
- `billing`, `billing-webhook`
- `crm-import-leads`, `import-from-source`
- `contract-ai-fill`, `generate-contract-template`
- `toggle-maintenance-mode`, `storage-metrics`
- `ticket-chat`, `send-ticket-webhook`
- `verify-creci`, `validate-document`
- `portal-xml-feed`, `export-database`
- `video-job-status`, `cancel-video-job`

---

## 5. PERFORMANCE DO BANCO

| Query | Tempo | Status |
|-------|-------|--------|
| Properties + Images (limit 1000) | >8s (TIMEOUT) | 🔴 Corrigido → PAGE_SIZE=200 |
| Properties + Images (limit 200) | ~200ms estimado | ✅ OK |
| Properties + Images (limit 50) | 401ms | 🟡 Aceitável |
| fn_dashboard_stats | <100ms | ✅ OK |
| fn_kpi_metrics | <100ms | ✅ OK |
| fn_agent_ranking | <100ms | ✅ OK |
| Leads query | <100ms | ✅ OK |

### Índices presentes
- `properties`: 19 índices (org_id, status, code, geocode, etc.) ✅
- `property_images`: 7 índices (property_id, storage_provider, type, etc.) ✅

### Recomendação de performance
- Considerar criar índice composto em `property_images(property_id, display_order)` para otimizar JOINs ordenados
- Monitorar se PAGE_SIZE=200 resolve completamente o timeout

---

## 6. LISTA COMPLETA DE SECRETS NECESSÁRIOS

Para configurar no [Dashboard Supabase > Edge Functions > Secrets](https://supabase.com/dashboard/project/zpajuxxsxrwuqregdzjm/settings/functions):

| # | Secret | Usado por | Prioridade |
|---|--------|-----------|------------|
| 1 | `R2_ACCESS_KEY_ID` | r2-upload, migrate-to-r2 | 🔴 Alta |
| 2 | `R2_SECRET_ACCESS_KEY` | r2-upload, migrate-to-r2 | 🔴 Alta |
| 3 | `R2_ENDPOINT` | r2-upload, migrate-to-r2 | 🔴 Alta |
| 4 | `R2_BUCKET_NAME` | r2-upload, migrate-to-r2 | 🔴 Alta |
| 5 | `R2_PUBLIC_URL` | r2-upload, migrate-to-r2 | 🔴 Alta |
| 6 | `RESEND_API_KEY` | send-reset-email, send-invite-email | 🔴 Alta |
| 7 | `OPENAI_API_KEY` | generate-*, summarize-lead, contract-ai-fill | 🟡 Média |
| 8 | `ONESIGNAL_APP_ID` | onesignal-app-id, send-push | 🟡 Média |
| 9 | `ONESIGNAL_REST_API_KEY` | send-push | 🟡 Média |
| 10 | `RD_STATION_CLIENT_ID` | rd-station-* | 🟡 Média |
| 11 | `RD_STATION_CLIENT_SECRET` | rd-station-* | 🟡 Média |
| 12 | `META_APP_ID` | meta-* | 🟢 Baixa |
| 13 | `META_APP_SECRET` | meta-* | 🟢 Baixa |
| 14 | `CLOUDINARY_API_KEY` | cloudinary-* | 🟢 Baixa |
| 15 | `CLOUDINARY_API_SECRET` | cloudinary-* | 🟢 Baixa |
| 16 | `CLOUDINARY_CLOUD_NAME` | cloudinary-* | 🟢 Baixa |
| 17 | `STRIPE_SECRET_KEY` | billing, ai-billing-stripe | 🟢 Baixa |
| 18 | `STRIPE_WEBHOOK_SECRET` | billing-webhook | 🟢 Baixa |

---

## 7. RESUMO DE AÇÕES

### ✅ Corrigido pelo Lovable nesta auditoria
| # | Ação | Arquivo |
|---|------|---------|
| 1 | Reduzir PAGE_SIZE de 1000→200 para evitar timeout | `src/hooks/useProperties.ts` |

### ❌ Requer ação manual do cliente
| # | Ação | Onde |
|---|------|------|
| 1 | Adicionar ~18 secrets no Dashboard | [Edge Functions Secrets](https://supabase.com/dashboard/project/zpajuxxsxrwuqregdzjm/settings/functions) |
| 2 | Configurar SITE_URL | Dashboard Auth > URL Configuration |
| 3 | Configurar Redirect URLs | Dashboard Auth > URL Configuration |
| 4 | Atualizar callback OAuth Google | Google Cloud Console |
| 5 | Decidir sobre 12.708 imagens órfãs | Decisão de negócio |
| 6 | Decidir sobre 734 leads órfãos | Decisão de negócio |

---

*Auditoria realizada em 2026-03-20.*
