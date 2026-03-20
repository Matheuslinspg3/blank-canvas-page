# 🔧 Auditoria de Ambiente e Conexão — Pós-Migração
> **Data**: 2026-03-20 | **Projeto destino**: `zpajuxxsxrwuqregdzjm`  
> **Projeto origem**: `aiflfkkjitvsyszwdfga`  

---

## 1. CONFIGURAÇÕES CRÍTICAS VALIDADAS

### 1.1 Variáveis do Frontend (.env)

| Variável | Valor configurado | Correto? |
|----------|------------------|----------|
| `VITE_SUPABASE_URL` | `https://zpajuxxsxrwuqregdzjm.supabase.co` | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...dzjm...` (ref=zpajuxxsxrwuqregdzjm) | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | `zpajuxxsxrwuqregdzjm` | ✅ |

### 1.2 Config.toml

| Item | Valor | Correto? |
|------|-------|----------|
| `project_id` | `zpajuxxsxrwuqregdzjm` | ✅ (corrigido na auditoria anterior) |

### 1.3 Supabase Client (src/integrations/supabase/client.ts)

| Item | Valor | Correto? |
|------|-------|----------|
| `SUPABASE_URL` | Lê de `VITE_SUPABASE_URL` | ✅ Dinâmico |
| `SUPABASE_PUBLISHABLE_KEY` | Lê de `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Dinâmico |

### 1.4 Edge Functions Secrets (Runtime)

| Secret | Presente? | Necessidade |
|--------|-----------|-------------|
| `LOVABLE_API_KEY` | ✅ | Auto-gerenciado |
| `SOURCE_SUPABASE_URL` | ✅ | Temporário (migração) |
| `SOURCE_SUPABASE_SERVICE_ROLE_KEY` | ✅ | Temporário (migração) |
| `GOOGLE_AI_KEY_1` | ❌ | Crítico |
| `GOOGLE_AI_KEY_2` | ❌ | Crítico |
| `RESEND_API_KEY` | ❌ | Crítico (emails) |
| `APP_URL` | ❌ | Crítico (links) |
| `APP_ALLOWED_ORIGINS` | ❌ | Crítico (CORS) |
| `ONESIGNAL_APP_ID` | ❌ | Alto (push) |
| `ONESIGNAL_REST_API_KEY` | ❌ | Alto (push) |
| `CLOUDINARY_CLOUD_NAME` | ❌ | Alto (mídia) |
| `CLOUDINARY_API_KEY` | ❌ | Alto (mídia) |
| `CLOUDINARY_API_SECRET` | ❌ | Alto (mídia) |
| `R2_ACCESS_KEY_ID` | ❌ | Alto (storage) |
| `R2_SECRET_ACCESS_KEY` | ❌ | Alto (storage) |
| `R2_BUCKET_NAME` | ❌ | Alto (storage) |
| `R2_ENDPOINT` | ❌ | Alto (storage) |
| `R2_PUBLIC_URL` | ❌ | Alto (storage) |
| `ASAAS_API_KEY` | ❌ | Alto (billing) |
| `ASAAS_WEBHOOK_TOKEN` | ❌ | Alto (billing) |
| `META_APP_ID` | ❌ | Médio |
| `META_APP_SECRET` | ❌ | Médio |
| `RD_STATION_CLIENT_ID` | ❌ | Médio |
| `RD_STATION_CLIENT_SECRET` | ❌ | Médio |
| `CLOUDFLARE_API_TOKEN` | ❌ | Médio |
| `CLOUDFLARE_ZONE_ID` | ❌ | Médio |
| `UAZAPI_BASE_URL` | ❌ | Médio |
| `UAZAPI_ADMIN_TOKEN` | ❌ | Médio |
| `GOOGLE_DRIVE_API_KEY` | ❌ | Médio |
| `GOOGLE_AI_PDF_KEY_1` | ❌ | Médio |
| `OPENAI_IMAGE_API_KEY` | ❌ | Médio |

**Resultado: 3/33 secrets configurados (9%)**

---

## 2. SINAIS TÍPICOS DE ERRO POR CONFIGURAÇÃO ERRADA

| Sintoma | Causa provável | Onde investigar |
|---------|---------------|-----------------|
| 401 Unauthorized em edge functions | Anon key errada / service role key ausente | Cron jobs, fetch direto |
| CORS bloqueado | `APP_ALLOWED_ORIGINS` ausente | Console do browser |
| "Database error querying schema" no login | auth.users com dados corrompidos | Supabase Auth logs |
| Push notifications silenciosas | GUC settings NULL + fallback antigo | `trigger_push_on_notification` |
| Emails não chegam | `RESEND_API_KEY` ausente | Edge function logs |
| Upload de fotos falha | `CLOUDINARY_*` ausentes | Edge function logs |
| AI features retornam erro | `GOOGLE_AI_KEY_*` ausentes | Edge function logs |
| Links em email apontam para URL errada | `APP_URL` ausente ou errado | Conteúdo do email |
| Meta Ads OAuth falha | `META_APP_*` ausentes + redirect URI errado | Console Meta Developer |
| Cron jobs sem efeito | Anon key do projeto antigo nos jobs | `cron.job` table |

---

## 3. REFERÊNCIAS AO AMBIENTE ANTIGO ENCONTRADAS

### 3.1 No banco de dados (ATIVAS — em execução)

| Local | Referência | Risco | Status |
|-------|-----------|-------|--------|
| **Cron job #7** (cleanup-orphan-media) | Anon key de `aiflfkkjitvsyszwdfga` no Bearer token | 🔴 Crítico | Jobs falham com 401 |
| **Cron job #8** (rd-station-sync-leads) | Anon key de `aiflfkkjitvsyszwdfga` no Bearer token | 🔴 Crítico | Jobs falham com 401 |
| **Função `trigger_push_on_notification`** | Fallback URL e anon key de `aiflfkkjitvsyszwdfga` | 🔴 Crítico | Push vai pro projeto antigo |
| **GUC settings** | `app.settings.supabase_url` = NULL | 🔴 Crítico | Trigger usa fallback antigo |

### 3.2 Em migrations (HISTÓRICAS — não re-executadas)

| Arquivo | Linha | Risco |
|---------|-------|-------|
| `20260220044041_*.sql` | URL hardcoded do antigo | ⚪ Nenhum (histórico) |
| `20260220044150_*.sql` | URL hardcoded do antigo | ⚪ Nenhum (histórico) |
| `20260317204734_*.sql` | URL fallback do antigo | ⚪ Nenhum (histórico) |

### 3.3 No código frontend/TS

| Arquivo | Tipo | Risco |
|---------|------|-------|
| `src/components/settings/SupportTicketDialog.tsx:150` | URL hardcoded para **outro projeto** (`kanrkkvzjbznytensgst`) | ⚠️ Intencional (webhook externo de suporte) |
| `src/pages/Maintenance.tsx` | Usa `${projectId}.supabase.co` (dinâmico) | ✅ OK |
| `src/components/ads/MetaSettingsContent.tsx` | Usa `${supabaseProjectId}.supabase.co` (dinâmico) | ✅ OK |
| `src/components/developer/SubscriptionsTab.tsx` | Usa `${projectId}.supabase.co` (dinâmico) | ✅ OK |
| `src/test/security-audit.test.ts` | Placeholder de teste | ✅ OK |

**✅ Nenhuma referência hardcoded ao projeto antigo no código TS/TSX.**

### 3.4 Valores hardcoded no código

Nenhum `localhost:54321`, nenhuma URL absoluta do projeto antigo no frontend.

---

## 4. CONFIRMAÇÃO: PROJETO APONTA PARA O NOVO BANCO?

### Checklist de validação ponto a ponto

| # | Verificação | Método | Resultado |
|---|------------|--------|----------|
| 1 | `.env` → `VITE_SUPABASE_URL` | Leitura do arquivo | ✅ `zpajuxxsxrwuqregdzjm` |
| 2 | `.env` → `VITE_SUPABASE_PUBLISHABLE_KEY` | Decodificar JWT → campo `ref` | ✅ `zpajuxxsxrwuqregdzjm` |
| 3 | `.env` → `VITE_SUPABASE_PROJECT_ID` | Leitura do arquivo | ✅ `zpajuxxsxrwuqregdzjm` |
| 4 | `supabase/config.toml` → `project_id` | Leitura do arquivo | ✅ `zpajuxxsxrwuqregdzjm` |
| 5 | `client.ts` → URLs dinâmicas | Análise do código | ✅ Usa env vars |
| 6 | Frontend → fetch de edge functions | Análise do código | ✅ Usa `projectId` dinâmico |
| 7 | Cron job #7 → URL | Query `cron.job` | ✅ URL correta, ❌ token errado |
| 8 | Cron job #8 → URL | Query `cron.job` | ✅ URL correta, ❌ token errado |
| 9 | Push trigger → GUC | `current_setting()` | ❌ NULL (usa fallback antigo) |
| 10 | Push trigger → fallback | Leitura da função | ❌ Aponta para antigo |

---

## 5. TABELA CONSOLIDADA

| # | Item | Risco | Método de validação | Status |
|---|------|-------|-------------------|--------|
| 1 | `.env` VITE_SUPABASE_URL | Crítico | Ler arquivo | ✅ Correto |
| 2 | `.env` VITE_SUPABASE_PUBLISHABLE_KEY | Crítico | Decodificar JWT ref | ✅ Correto |
| 3 | `.env` VITE_SUPABASE_PROJECT_ID | Crítico | Ler arquivo | ✅ Correto |
| 4 | `config.toml` project_id | Médio | Ler arquivo | ✅ Correto |
| 5 | `client.ts` sem hardcode | Crítico | Search no código | ✅ Dinâmico |
| 6 | Frontend fetch URLs | Crítico | Search `supabase.co` | ✅ Dinâmico |
| 7 | Cron job #7 Bearer token | Crítico | Query `cron.job` | 🔴 **Token antigo** |
| 8 | Cron job #8 Bearer token | Crítico | Query `cron.job` | 🔴 **Token antigo** |
| 9 | GUC `app.settings.supabase_url` | Crítico | `current_setting()` | 🔴 **NULL** |
| 10 | GUC `app.settings.supabase_anon_key` | Crítico | `current_setting()` | 🔴 **NULL** |
| 11 | Push trigger fallback | Crítico | Ler `prosrc` da função | 🔴 **URL antiga** |
| 12 | Secrets (30+ ausentes) | Crítico | `fetch_secrets` | 🔴 **91% ausentes** |
| 13 | RLS habilitado | Crítico | Query `pg_class` | ✅ 89/89 |
| 14 | Policies definidas | Crítico | Count `pg_policies` | ✅ 283 |
| 15 | Storage buckets | Alto | Query `storage.buckets` | ✅ 5 buckets |
| 16 | Storage policies | Alto | Query `pg_policies` storage | ✅ 16 policies |
| 17 | Realtime | Médio | Query `pg_publication_tables` | ⚠️ `leads` ausente |
| 18 | Extensões | Alto | Query `pg_extension` | ✅ Todas presentes |
| 19 | Triggers | Alto | Count `pg_trigger` | ✅ 54 ativos |
| 20 | SupportTicketDialog URL | Baixo | Search no código | ⚠️ Externo intencional |

---

## 6. AÇÕES DE CORREÇÃO NECESSÁRIAS

### 🔴 Imediatas (requerem Supabase Dashboard)

#### 6.1 — Corrigir Cron Jobs (SQL Editor)
```sql
-- Deletar jobs antigos
SELECT cron.unschedule(7);
SELECT cron.unschedule(8);

-- Recriar com nova anon key
SELECT cron.schedule(
  'cleanup-orphan-media',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/cleanup-orphan-media',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'rd-station-sync-leads',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/rd-station-sync-leads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body := '{"auto_sync": true}'::jsonb
  ) AS request_id;
  $$
);
```

#### 6.2 — Configurar GUC Settings (SQL Editor)
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://zpajuxxsxrwuqregdzjm.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0';
```

#### 6.3 — Adicionar Secrets (Dashboard → Settings → Edge Functions → Secrets)
Copiar os valores do projeto antigo para o novo. Ver lista completa em `SECRETS_MIGRATION_CHECKLIST.md`.

---

## VEREDITO

| Aspecto | Score |
|---------|-------|
| Frontend → novo banco | ✅ 100% |
| Edge Functions deploy target | ✅ 100% |
| Código TS sem hardcodes | ✅ 100% |
| Banco → estrutura | ✅ 100% |
| Banco → automações (cron/trigger) | 🔴 0% (tokens antigos) |
| Secrets operacionais | 🔴 9% |
| **Pronto para produção?** | **❌ NÃO** — 3 bloqueadores pendentes |
