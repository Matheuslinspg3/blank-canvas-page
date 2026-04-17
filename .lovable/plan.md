

# Auditoria Técnica — Porta do Corretor (Retell + Leads + CRM)

## 1. ARQUITETURA GERAL

**Stack**
- **Frontend**: React 18 + Vite 5 + TS, Tailwind, TanStack Query, `retell-client-js-sdk` (WebRTC).
- **Backend**: Supabase Edge Functions (Deno) — ~140 funções em `supabase/functions/*`.
- **Banco**: Postgres (Supabase) com RLS multi-tenant via `get_user_organization_id()` e `has_role()`.
- **Orquestração externa**: n8n self-hosted (workflow `FvO...` Retell, `HyoHStUv2ZhXnnTG` WhatsApp), autenticado via header `X-Webhook-Secret`.
- **Storage**: Supabase (privado), Cloudflare R2 (mídia), Cloudinary (logos).
- **Filas**: Não existe fila dedicada (Inngest/BullMQ/pg_boss). Há `pg_cron` (ex: domínios) + tabelas-fila ad-hoc (`follow_up_queue`).
- **AI Router**: `supabase/functions/ai-router` (multi-provider OpenAI/Anthropic/Gemini/Groq, billing por tokens).

**Comunicação**
- Frontend → Edge Functions via `supabase.functions.invoke()`.
- Edge Functions ↔ n8n via webhook + `X-Webhook-Secret`.
- Retell → Supabase via webhook HTTP em `retell-webhook`.
- n8n → Supabase via `retell-qualify-call` (autenticada por shared secret).

**Onde Retell se encaixa hoje**: Apenas como widget de **chamada web (WebRTC) no painel** + recepção de eventos pós-chamada. **Não há disparo outbound automático.**

---

## 2. INTEGRAÇÃO ATUAL COM RETELL

**Existe — parcialmente.** Inventário completo:

### Edge Functions
| Função | Papel |
|---|---|
| `retell-create-web-call` | Cria `web_call` (WebRTC browser) via `POST https://api.retellai.com/v2/create-web-call`. Insere registro em `voice_calls` (call_type='web_call'). |
| `retell-webhook` | Recebe eventos `call_started` / `call_ended` / `call_analyzed`. Atualiza `voice_calls`. Dispara `n8n_webhook_url` (config por org) com `X-Webhook-Secret`. |
| `retell-qualify-call` | Chamada por n8n. Usa `ai-router` para extrair JSON (nome/telefone/orçamento/score). Atualiza `voice_calls.metadata`. Cria lead em `leads` se `auto_create_leads=true`. Atribui broker (round-robin simples). |
| `retell-sync-flow` | Sincroniza `retell_flow_steps` → fluxo conversational do agente Retell. |

### Frontend (`src/components/automations/retell/`)
- `RetellVoicePanel.tsx` — abas: Config, Call (widget), Histórico, Flow.
- `RetellCallWidget.tsx` — usa `retell-client-js-sdk` para WebRTC.
- `RetellConfigTab.tsx` — edita `retell_agent_config` (agent_id, prompt, scoring, n8n_webhook_url).
- `RetellCallHistory.tsx` — lista `voice_calls`.
- `RetellFlowEditor.tsx` — editor visual do flow.
- `useRetellConfig.ts` — hook React Query.

### Webhook URL configurada
`https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/retell-webhook` (registrado em `mem://integrations/retell/webhook-configuration`).

### O que existe
- ✅ Web calls (browser→Retell via SDK).
- ✅ Webhooks Retell (call_started/ended/analyzed).
- ✅ Análise pós-chamada IA + criação automática de lead.
- ✅ Persistência completa em `voice_calls`.
- ✅ Sincronização de flow conversacional.

### O que NÃO existe
- ❌ **Outbound call** (`POST /v2/create-phone-call`). Nenhum arquivo com `create-phone-call` ou `createPhoneCall`.
- ❌ Inbound (número receptor configurado no Retell).
- ❌ Custom functions (tools que o agente Retell pode chamar durante a ligação).
- ❌ Trigger automático de ligação ao criar lead.
- ❌ Controle de tentativas/retries de discagem.
- ❌ Janela de horário comercial respeitada no disparo.

---

## 3. FLUXO DE ENTRADA DE LEADS

Pontos de entrada identificados:

| Origem | Edge Function | Auth | Cria lead? |
|---|---|---|---|
| **Meta Ads** | `meta-sync-leads` (manual/agendado) + `meta-oauth-callback`, `meta-sync-entities` | JWT user + token Meta | Sim, em modo `import` |
| **RD Station** | `rd-station-webhook` (push real-time) + `rd-station-sync-leads` (pull) | `?token=<webhook_secret>` | Sim, se `auto_send_to_crm=true` |
| **Site público** | `website-lead` + `create-site-lead` | Anônima (precisa `organization_id`) | Sim |
| **WhatsApp** | `whatsapp-create-lead` + trigger DB `trg_auto_create_lead` | Service role | Sim (auto via msg recebida) |
| **CSV import** | `crm-import-leads` | JWT | Sim (em lote) |
| **Imobzi** | `imobzi-import` / `-process` | JWT | Sim |
| **Retell** | `retell-qualify-call` | Webhook secret / service role | Sim, se `auto_create_leads=true` |

**Normalização**: cada handler faz a sua (telefone via `replace(/\D/g,'')`, email lowercase). Não há serviço único.

**Deduplicação**: 
- Em código: cada handler busca duplicado por email/phone antes do insert (RD Station faz, Meta faz).
- No banco: trigger `trg_lead_dedup_normalize` documentado em `mem://database/lead-integrity-protection` (PostgreSQL trigger normaliza e bloqueia em insert).

---

## 4. MODELO DE DADOS DO LEAD

### Tabela `public.leads` (campos confirmados via schema)
```
id uuid PK, organization_id uuid NN, created_by uuid NN,
name text NN, email text, phone text,
stage USER-DEFINED (enum legado), lead_stage_id uuid → lead_stages,
lead_type_id uuid, broker_id uuid, property_id uuid,
estimated_value numeric, source text, notes text,
temperature text ('quente'|'morno'|'frio'),
score int, position int, is_active bool,
external_source text, external_id text, imported_at timestamptz,
conversion_identifier text, traffic_source text,
transaction_interest text, min/max_bedrooms/bathrooms/parking int,
min/max_area numeric, preferred_neighborhoods/cities text[],
interested_property_type_ids uuid[], additional_requirements text,
ai_summary text, ai_summary_at timestamptz,
inactivation_reason/by/at,
created_at, updated_at
```

### Relações
- `leads.organization_id → organizations.id`
- `leads.lead_stage_id → lead_stages.id` (Kanban)
- `leads.broker_id → profiles.user_id`
- `leads.property_id → properties.id`
- `lead_interactions.lead_id → leads.id` (histórico)
- `voice_calls.lead_id → leads.id`
- `appointments.lead_id`, `contracts.lead_id`, `invoices.lead_id`

### Payload exemplo (RD Station webhook real, gerado por `rd-station-webhook`)
```json
{
  "organization_id": "<uuid>",
  "name": "João da Silva",
  "email": "joao@x.com",
  "phone": "13991234567",
  "source": "RD Station (Webhook)",
  "lead_stage_id": "<first stage>",
  "external_id": "rd_uuid_xxx",
  "external_source": "rdstation",
  "conversion_identifier": "Formulário Apto Guilhermina",
  "traffic_source": "google/cpc",
  "property_id": "<matched uuid|null>",
  "notes": "Anúncio/Formulário: ..."
}
```

---

## 5. EVENTOS E AUTOMAÇÕES PÓS-LEAD

**Hoje, ao inserir um lead**:
- ✅ Notificação interna a managers (RD Station webhook faz via `rpc insert_notification`).
- ✅ Trigger `trg_auto_create_lead` (WhatsApp): apenas para mensagens recebidas, não para leads de outras fontes.
- ❌ **Nenhum trigger DB que dispare ligação** (`information_schema.triggers` em `leads` retornou vazio para discagem).
- ❌ Sem fila de jobs (sem Inngest/pg_boss).
- ❌ Sem retry framework.
- ✅ Follow-up WhatsApp existe (`follow_up_queue` + `whatsapp-followup-batch` + `pg_cron`), mas é **só WhatsApp**, não voz.

---

## 6. SISTEMA DE LIGAÇÕES

- **Outbound automático**: ❌ **NÃO EXISTE**. Grep por `create-phone-call`/`outbound` em edge functions retorna apenas resultados de WhatsApp follow-up.
- **Manual**: ✅ Apenas `RetellCallWidget` (corretor clica e fala via browser/WebRTC).
- **Controle de tentativas/retry**: ❌ inexistente para voz.
- **Horário comercial**: campos `working_hours_start/end` existem em `retell_agent_config` mas **não são consumidos por nenhum scheduler**.

---

## 7. WEBHOOKS

| Webhook | Endpoint | Tratamento |
|---|---|---|
| RD Station | `/functions/v1/rd-station-webhook?token=...` | Cria/dedup lead, loga em `rd_station_webhook_logs`, notifica managers |
| Meta Ads | (sem webhook real-time; usa `meta-sync-leads` agendado) | Insert em `ad_leads` → `leads` |
| Retell | `/functions/v1/retell-webhook` | Atualiza `voice_calls` por `event` → encaminha para n8n |
| WhatsApp (Evolution) | `/functions/v1/whatsapp-webhook-config` | Roteia mensagens, agente IA, mídia |
| Billing | `/functions/v1/billing-webhook` | Stripe events |
| Site público | `/functions/v1/website-lead` | Cria lead |

---

## 8. GAPS PARA "Lead entra → IA liga → entrevista → CRM"

### Já existe
- Recepção de leads (Meta/RD/site/WhatsApp).
- `voice_calls` schema completo.
- `retell-webhook` recebendo eventos.
- `retell-qualify-call` extraindo dados via IA e populando lead.
- n8n orquestrando pós-chamada.

### Falta
1. **Edge function `retell-trigger-outbound-call`** — chama `POST https://api.retellai.com/v2/create-phone-call` com `from_number`, `to_number`, `agent_id`, `metadata{lead_id, organization_id}`.
2. **Trigger DB `trg_lead_voice_call`** em `AFTER INSERT ON leads` que invoca a edge function via `pg_net` (ou enfileira em nova tabela `voice_call_queue`).
3. **Tabela `voice_call_queue`** com `lead_id`, `status` (pending/calling/done/failed), `attempt_count`, `next_attempt_at`, `last_error`.
4. **Worker via `pg_cron`** (a cada 1 min) que processa fila respeitando `working_hours_start/end`, max retries (3), backoff exponencial.
5. **Coluna `retell_phone_number` + `retell_from_number`** em `retell_agent_config` (número comprado no Retell).
6. **Custom Function (Retell tool)** "transfer_to_broker" e "schedule_visit" para o agente acionar durante a chamada.
7. **Validação de telefone E.164** (BR `+55…`) antes de discar.
8. **Opt-in/LGPD** — checkbox/flag em `leads.consent_voice_call` + bloqueio se ausente.
9. **Configuração por origem** — nem todo lead deve receber ligação (ex: lead frio do site sem telefone).

### Ajustes necessários
- `retell-qualify-call` hoje busca broker com `profiles.role='broker'` mas a coluna correta é via `user_roles` (RBAC) — **bug existente**, deve mudar para `has_role(user_id,'corretor')`.
- `retell-create-web-call` chama Retell com `RETELL_API_KEY` global; outbound deve ler chave **por org** (BYOK) ou usar a global com flag.

---

## 9. RISCOS E PROBLEMAS ATUAIS

1. **`retell-qualify-call` quebrado parcialmente**: query `profiles.role='broker'` não condiz com schema atual (roles em `user_roles`). Atribuição de broker não funciona.
2. **`retell-webhook` sem verificação de assinatura HMAC** do Retell — qualquer um com a URL pode forjar eventos.
3. **`website-lead`/`create-site-lead` sem rate limit nem captcha** — vulnerável a flood.
4. **Dedup multi-fonte inconsistente**: cada handler reimplementa, com normalizações diferentes (RD usa `endsWith` parcial, Meta não).
5. **Sem fila durável**: se a edge function cair durante processamento, lead se perde.
6. **`retell_agent_config.n8n_webhook_url` em texto puro** — não há rotação/secret manager.
7. **Sem controle de concorrência**: dois webhooks simultâneos do mesmo lead podem criar duplicados (raça).
8. **`auto_create_leads` cria lead sem `created_by`** — campo é `NN` no schema, pode falhar.
9. **Nenhum índice** confirmado em `voice_calls(call_id)` ou `(organization_id, created_at)` — risco de lentidão no histórico.

---

## 10. RECOMENDAÇÃO TÉCNICA

### Arquitetura proposta

```text
[Meta/RD/Site/WhatsApp] 
        │
        ▼
[ingest edge function] ──insert──► leads (RLS)
                                     │
                                     ▼
                          AFTER INSERT trigger
                                     │
                                     ▼
                          voice_call_queue (pending)
                                     │
              ┌──────────── pg_cron (1 min) ──────────────┐
              │   - filtra working_hours                  │
              │   - filtra consent + telefone E.164       │
              │   - max 3 tentativas, backoff 30/120/360m │
              └──────────────────┬────────────────────────┘
                                 ▼
              [retell-trigger-outbound-call] ──HTTPS──► Retell /v2/create-phone-call
                                 │
                                 ▼ (insert)
                          voice_calls (registered)
                                 │
                                 ▼ webhooks
                          [retell-webhook] (HMAC verify)
                                 │
                          ├─► UPDATE voice_calls
                          └─► n8n (X-Webhook-Secret)
                                 │
                                 ▼
                     [retell-qualify-call]
                                 │
                          ├─► UPDATE leads (score, temperature, ai_summary)
                          ├─► assign broker via has_role()
                          └─► insert lead_interactions + notification
```

### Implementação sugerida (passos)
1. **Migration**: criar `voice_call_queue`, índices em `voice_calls`, coluna `consent_voice_call` em `leads`, `retell_from_number` em `retell_agent_config`.
2. **Trigger**: `trg_enqueue_voice_call` em `AFTER INSERT ON leads` filtrando por `is_active`, telefone presente e `retell_agent_config.enabled=true`.
3. **Edge function `retell-trigger-outbound-call`** (BYOK + global fallback, validação E.164).
4. **Edge function `voice-call-queue-worker`** chamada por `pg_cron` cada 1 min.
5. **Endurecer `retell-webhook`**: validar header `x-retell-signature` com HMAC SHA-256.
6. **Corrigir `retell-qualify-call`**: usar `user_roles` + `created_by` (admin da org como fallback).
7. **Custom Functions Retell**: registrar tools (`transfer_to_broker`, `schedule_visit`, `lookup_property`) no agent + endpoints correspondentes.
8. **UI**: aba "Discagem Automática" em `RetellConfigTab` com toggle, horário, max tentativas, opt-in obrigatório.
9. **LGPD**: bloqueio em `trg_enqueue_voice_call` se `consent_voice_call=false`.
10. **Observabilidade**: tabela `voice_call_logs` (eventos), dashboard simples no painel.

### Custos/risco
- Custo Retell por minuto + número phone (~$1/mês + $0.07/min). Implementar `max_call_duration_min` (já existe na config) como hard-stop.
- Anti-spam: debounce — não ligar se já existe `voice_calls` para o mesmo lead nas últimas 24h.

