# ⚙️ Auditoria de Automações, Triggers, Edge Functions e Integrações
> **Data**: 2026-03-20 | **Banco**: `zpajuxxsxrwuqregdzjm`

---

## 🔴 ACHADOS CRÍTICOS

### CRIT-1: 8 triggers DESABILITADOS na tabela `properties`

| Trigger | Função | Status |
|---------|--------|--------|
| `log_property_created` | `log_activity_on_insert` | ❌ DISABLED |
| `trg_audit_properties` | `audit_property_changes` | ❌ DISABLED |
| `trg_log_property_updated` | `log_property_updated` | ❌ DISABLED |
| `trg_property_availability_change` | `log_property_availability_change` | ❌ DISABLED |
| `trigger_auto_property_code` | `auto_generate_property_code` | ❌ DISABLED |
| `trigger_capture_media_before_delete` | `capture_media_before_property_delete` | ❌ DISABLED |
| `trigger_cascade_marketplace_delete` | `cascade_delete_marketplace` | ❌ DISABLED |
| `update_properties_updated_at` | `update_updated_at_column` | ❌ DISABLED |

**Impacto**:
- Imóveis criados **não recebem código automático** (`property_code`)
- `updated_at` **não é atualizado** ao editar imóveis
- Exclusão de imóveis **não cascateia** para marketplace
- **Nenhum log de auditoria** é gerado para operações em properties
- Mídia não é capturada antes de delete (dados perdidos)

**Correção**: Executar migration SQL:
```sql
ALTER TABLE properties ENABLE TRIGGER ALL;
```

### CRIT-2: Cron jobs usando ANON KEY do projeto ANTIGO

Os 2 cron jobs estão apontando para a URL correta (`zpajuxxsxrwuqregdzjm`) mas usando o **anon key do projeto antigo** (`aiflmkkjitvssyswdfga`):

| Job | Schedule | Função | Token |
|-----|----------|--------|-------|
| #7 | `0 */6 * * *` (6h em 6h) | `cleanup-orphan-media` | 🔴 Token antigo |
| #8 | `*/15 * * * *` (15 min) | `rd-station-sync-leads` | 🔴 Token antigo |

**Impacto**: Os cron jobs **falham silenciosamente** — a edge function rejeita o token inválido com 401. Limpeza de mídia órfã e sync de leads RD Station **não estão funcionando**.

**Correção**: Atualizar os cron jobs com o novo anon key:
```sql
SELECT cron.unschedule(7);
SELECT cron.unschedule(8);

SELECT cron.schedule(
  'cleanup-orphan-media',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/cleanup-orphan-media',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'rd-station-sync-leads',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/rd-station-sync-leads',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body:='{"auto_sync": true}'::jsonb
  ) AS request_id;
  $$
);
```

### CRIT-3: Secrets ausentes para edge functions

Apenas **3 secrets** existem no projeto. As edge functions precisam de muito mais:

| Secret necessário | Edge Function(s) | Status |
|-------------------|-------------------|--------|
| `R2_ACCESS_KEY_ID` | r2-upload, migrate-to-r2 | ❌ Ausente |
| `R2_SECRET_ACCESS_KEY` | r2-upload, migrate-to-r2 | ❌ Ausente |
| `R2_ENDPOINT` | r2-upload, migrate-to-r2 | ❌ Ausente |
| `R2_BUCKET_NAME` | r2-upload, migrate-to-r2 | ❌ Ausente |
| `R2_PUBLIC_URL` | r2-upload, migrate-to-r2 | ❌ Ausente |
| `OPENAI_API_KEY` | generate-ad-content, summarize-lead, validate-document, etc. | ❌ Ausente |
| `RESEND_API_KEY` | send-invite-email, send-reset-email | ❌ Ausente |
| `ONESIGNAL_APP_ID` | send-push, onesignal-app-id | ❌ Ausente |
| `ONESIGNAL_API_KEY` | send-push | ❌ Ausente |
| `META_APP_ID` | meta-oauth-callback, meta-app-id | ❌ Ausente |
| `META_APP_SECRET` | meta-oauth-callback, meta-sync-leads | ❌ Ausente |
| `RD_STATION_CLIENT_ID` | rd-station-* | ❌ Ausente |
| `RD_STATION_CLIENT_SECRET` | rd-station-* | ❌ Ausente |
| `CLOUDINARY_*` | cloudinary-cleanup, cloudinary-sign | ❌ Ausente |
| `CLOUDFLARE_*` | cloudflare-purge-cache | ❌ Ausente |
| `LEONARDO_API_KEY` | generate-property-art | ❌ Ausente |
| `STABILITY_AI_KEY` | generate-ad-image | ❌ Ausente |

**Impacto**: Todas essas edge functions **falham ao executar** por falta de credenciais. Não há erro no frontend — as funções simplesmente retornam erro 500 ou dados vazios.

---

## ✅ ACHADOS POSITIVOS

### Triggers habilitados (funcionando)

| Tabela | Triggers ativos | Status |
|--------|----------------|--------|
| appointments | 2 (log + updated_at) | ✅ |
| commissions | 1 (audit) | ✅ |
| contract_templates | 1 (updated_at) | ✅ |
| contracts | 3 (log + audit + updated_at) | ✅ |
| invoices | 1 (updated_at) | ✅ |
| lead_interactions | 1 (activity log) | ✅ |
| lead_score_events | 1 (recalculate score) | ✅ |
| leads | 5 (log + audit + updated + notify + overload) | ✅ |
| marketplace_properties | 1 (updated_at) | ✅ |
| notifications | 1 (push) | ✅ |
| organizations | 2 (slug + updated_at) | ✅ |
| profiles | 1 (updated_at) | ✅ |

### Funções SQL (102 funções existentes)

Todas as funções SQL estão presentes no banco, incluindo:
- **Auth/Role**: `has_role`, `is_org_admin`, `is_system_admin`, `handle_new_user`
- **Negócio**: `fn_dashboard_stats`, `fn_pipeline_summary`, `search_properties_*`
- **Auditoria**: `audit_*_changes`, `log_*`, `insert_audit_event`
- **Admin**: `admin_get_*_metrics`, `admin_get_system_health`

### Extensões necessárias

| Extensão | Versão | Status |
|----------|--------|--------|
| pg_cron | 1.6.4 | ✅ Instalada |
| pg_net | 0.20.0 | ✅ Instalada |
| pg_trgm | 1.6 | ✅ Instalada |
| pgcrypto | 1.3 | ✅ Instalada |

### Edge Functions (68 funções deployadas)

Todas as 68 edge functions estão presentes no repositório e deployadas.

---

## 📋 INVENTÁRIO COMPLETO DE AUTOMAÇÕES

### 1. Triggers por tabela

| Tabela | Trigger | Evento | Função | Status |
|--------|---------|--------|--------|--------|
| appointments | log_appointment_created | AFTER INSERT | log_activity_on_insert | ✅ |
| appointments | update_appointments_updated_at | BEFORE UPDATE | update_updated_at_column | ✅ |
| commissions | trg_audit_commissions | AFTER INSERT/UPDATE | audit_commission_changes | ✅ |
| contracts | log_contract_created | AFTER INSERT | log_activity_on_insert | ✅ |
| contracts | trg_audit_contracts | AFTER INSERT/UPDATE/DELETE | audit_contract_changes | ✅ |
| contracts | update_contracts_updated_at | BEFORE UPDATE | update_updated_at_column | ✅ |
| leads | log_lead_created | AFTER INSERT | log_activity_on_insert | ✅ |
| leads | trg_audit_leads | AFTER INSERT/UPDATE/DELETE | audit_lead_changes | ✅ |
| leads | trg_log_lead_updated | AFTER UPDATE | log_lead_updated | ✅ |
| leads | trg_notify_broker_overload | AFTER INSERT/UPDATE | notify_broker_lead_overload | ✅ |
| leads | trg_notify_unassigned_lead | AFTER INSERT | notify_unassigned_lead | ✅ |
| leads | update_leads_updated_at | BEFORE UPDATE | update_updated_at_column | ✅ |
| notifications | on_notification_send_push | AFTER INSERT | trigger_push_on_notification | ✅ |
| organizations | set_org_slug | BEFORE INSERT | auto_set_org_slug | ✅ |
| **properties** | **log_property_created** | **AFTER INSERT** | **log_activity_on_insert** | **❌ DISABLED** |
| **properties** | **trg_audit_properties** | **AFTER ALL** | **audit_property_changes** | **❌ DISABLED** |
| **properties** | **trg_log_property_updated** | **AFTER UPDATE** | **log_property_updated** | **❌ DISABLED** |
| **properties** | **trg_property_availability_change** | **BEFORE UPDATE** | **log_property_availability_change** | **❌ DISABLED** |
| **properties** | **trigger_auto_property_code** | **BEFORE INSERT** | **auto_generate_property_code** | **❌ DISABLED** |
| **properties** | **trigger_capture_media_before_delete** | **BEFORE DELETE** | **capture_media_before_property_delete** | **❌ DISABLED** |
| **properties** | **trigger_cascade_marketplace_delete** | **BEFORE DELETE** | **cascade_delete_marketplace** | **❌ DISABLED** |
| **properties** | **update_properties_updated_at** | **BEFORE UPDATE** | **update_updated_at_column** | **❌ DISABLED** |

### 2. Cron Jobs

| Job | Schedule | Target | Status |
|-----|----------|--------|--------|
| cleanup-orphan-media | 6h em 6h | Edge Function | 🔴 Token inválido |
| rd-station-sync-leads | 15 min | Edge Function | 🔴 Token inválido |

### 3. Edge Functions por categoria

| Categoria | Funções | Secrets necessários |
|-----------|---------|-------------------|
| **Auth/Admin** | admin-users, platform-signup, manage-member, accept-invite | — (usam SUPABASE_*) |
| **Email** | send-invite-email, send-reset-email | RESEND_API_KEY |
| **Push** | send-push, notifications-register-device | ONESIGNAL_APP_ID, ONESIGNAL_API_KEY |
| **Storage** | r2-upload, r2-presign, migrate-to-r2 | R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL |
| **AI** | generate-ad-content, generate-ad-image, generate-property-art, summarize-lead, validate-document, test-ai-connection | OPENAI_API_KEY, STABILITY_AI_KEY, LEONARDO_API_KEY |
| **Meta Ads** | meta-oauth-callback, meta-app-id, meta-save-account, meta-sync-leads, meta-sync-entities | META_APP_ID, META_APP_SECRET |
| **RD Station** | rd-station-*, rd-station-webhook | RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET |
| **Cloudinary** | cloudinary-cleanup, cloudinary-sign, cloudinary-purge, cloudinary-image-proxy | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET |
| **Imobzi** | imobzi-list, imobzi-process, imobzi-import | — (API key vem do frontend) |
| **Billing** | billing, billing-webhook, admin-subscriptions, ai-billing-stripe | STRIPE_SECRET_KEY |
| **WhatsApp** | whatsapp-instance, whatsapp-send | WHATSAPP_API_URL, WHATSAPP_API_KEY |

---

## 🔍 COMO DETECTAR FALHAS SILENCIOSAS

### 1. Triggers desabilitados
```sql
SELECT tgname, c.relname, tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal AND tgenabled = 'D';
```

### 2. Cron jobs falhando
```sql
SELECT jobid, jobname, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 20;
```

### 3. Edge functions sem secrets
Verificar logs no Dashboard: cada função que falha por secret ausente logará `"R2 config incompleta"`, `"Missing API key"`, etc.

### 4. Funções SQL referenciando objetos inexistentes
```sql
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%exec_sql%';
```

### 5. `exec_sql` — Função perigosa encontrada
A função `exec_sql` existe no banco. Isso é um **risco de segurança** — permite execução arbitrária de SQL. Verificar se tem RLS ou restrição de acesso.

---

## 📊 MATRIZ DE RISCO FINAL

| Automação | Evento disparador | Dependência | Risco | Validação |
|-----------|-------------------|-------------|-------|-----------|
| `auto_generate_property_code` | INSERT em properties | Trigger DISABLED | 🔴 **Crítico** | Criar imóvel e verificar se `property_code` é gerado |
| `update_properties_updated_at` | UPDATE em properties | Trigger DISABLED | 🔴 **Crítico** | Editar imóvel e verificar `updated_at` |
| `cascade_delete_marketplace` | DELETE em properties | Trigger DISABLED | 🔴 **Crítico** | Deletar imóvel e verificar marketplace |
| `audit_property_changes` | ALL em properties | Trigger DISABLED | 🟡 **Alto** | Editar imóvel e verificar audit_events |
| `capture_media_before_delete` | DELETE em properties | Trigger DISABLED | 🟡 **Alto** | Deletar imóvel e verificar deleted_property_media |
| Cron cleanup-orphan-media | pg_cron cada 6h | Anon key INVÁLIDO | 🔴 **Crítico** | Verificar cron.job_run_details |
| Cron rd-station-sync | pg_cron cada 15min | Anon key INVÁLIDO | 🔴 **Crítico** | Verificar cron.job_run_details |
| r2-upload | Chamada do frontend | 5 secrets R2 AUSENTES | 🔴 **Crítico** | Upload de foto em imóvel |
| send-invite-email | Convite de membro | RESEND_API_KEY AUSENTE | 🟡 **Alto** | Convidar membro para org |
| send-push | INSERT em notifications | ONESIGNAL_* AUSENTES | 🟡 **Alto** | Criar notificação no banco |
| generate-ad-content | Ação do usuário | OPENAI_API_KEY AUSENTE | 🟡 **Médio** | Gerar anúncio via UI |
| meta-sync-leads | Ação/cron | META_* AUSENTES | 🟡 **Médio** | Sincronizar leads Meta |
| handle_new_user | auth.users INSERT | Trigger ativo | ✅ OK | Criar novo usuário |
| audit_lead_changes | ALL em leads | Trigger ativo | ✅ OK | Editar lead |
| recalculate_lead_score | INSERT lead_score_events | Trigger ativo | ✅ OK | Adicionar evento de score |
| trigger_push_on_notification | INSERT notifications | Trigger ativo (mas push falha sem OneSignal) | ⚠️ Parcial | Inserir notificação |
| log_activity_on_insert | INSERT em appointments/contracts/leads | Triggers ativos | ✅ OK | Criar registro |
| `exec_sql` | Chamada RPC | Sem restrição aparente | 🔴 **Segurança** | Remover ou restringir |

---

## ✅ CHECKLIST DE CORREÇÕES PRIORITÁRIAS

| # | Ação | Impacto | Esforço |
|---|------|---------|---------|
| 1 | `ALTER TABLE properties ENABLE TRIGGER ALL;` | 🔴 Restaura 8 automações críticas | Baixo (1 SQL) |
| 2 | Atualizar cron jobs com novo anon key | 🔴 Restaura sync automático | Baixo (SQL acima) |
| 3 | Adicionar secrets de R2 no Dashboard | 🔴 Restaura upload de fotos | Médio |
| 4 | Adicionar RESEND_API_KEY | 🟡 Restaura emails | Baixo |
| 5 | Adicionar ONESIGNAL_* | 🟡 Restaura push notifications | Baixo |
| 6 | Adicionar OPENAI_API_KEY | 🟡 Restaura funcionalidades AI | Baixo |
| 7 | Remover ou restringir `exec_sql` | 🔴 Segurança | Baixo |
| 8 | Adicionar demais secrets (Meta, RD, etc.) | 🟡 Restaura integrações | Médio |
