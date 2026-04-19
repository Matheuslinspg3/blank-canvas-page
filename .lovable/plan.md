`, já que não há nada a "planejar implementar" ainda.
<lov-tool-use id="toolu_vrtx_01PzQK1GUxi1ZdLNLWLyXWxg" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01G47dEWnYFUw8BC3TJqe71B" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/pages\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EYKoQyvLZGTzNMZ9iMpw87" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select table_name from information_schema.tables where table_schema='public' order by table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NMCu4dPavuDSUxipXSHsvz" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DH15Uxi3PeVDYMPYA17zbF" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/pages\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01R3HfysuHCEbqqHKVZmxHF9" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select table_name from information_schema.tables where table_schema='public' order by table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CjnfS9s9GhXJAAviUsiBpp" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select table_name from information_schema.tables where table_schema='public' and (table_name like 'whatsapp%' or table_name like '%message%' or table_name like '%chat%' or table_name like '%conversation%' or table_name like '%inbox%' or table_name like '%channel%') order by table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017aCZ2fiDobwCg8Ftv2sUTg" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Automations.tsx\", \"lines\": \"1-30\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EticDkmCJa29xS3k5ojcGP" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name='leads' order by ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011tJao1J78VC9JW4wCv6Yzp" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name='automations' order by ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TznLox4Dyp2BNQMouVwq3d" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name='whatsapp_messages' order by ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JdVU4sUQaMFW2KmbFRC3rM" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name='whatsapp_instances' order by ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CkNDUsNWLiwVEbvvsXF4H1" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('lead_interactions','lead_stages','notifications','tasks','automation_executions') order by table_name, ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CsgbkNxSN6HsrwBiUtN2Tr" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"select slug, name, marketplace_access, partnership_access from subscription_plans order by slug;\"}">
</lov-tool-use>
Tenho contexto suficiente. Vou entregar o relatório direto — não é tarefa de implementação, é auditoria/pesquisa, então pulo o `<lov-plan>` conforme regra do modo plano.

---

# Auditoria Técnica — Hub de Automação Omnichannel (Porta do Corretor)

## 1. Visão geral do sistema

- **O que é**: ERP/CRM imobiliário SaaS multi-tenant white-label (Habitae / Porta do Corretor) para imobiliárias e corretores. Domínio principal: `portadocorretor.com.br`.
- **Módulos existentes**: Dashboard, Imóveis, CRM (Kanban de leads), Contratos, Financeiro, Marketplace inter-imobiliárias, Automações, Agenda, Integrações, Site Builder (white-label), Anúncios (gerador de criativos), Correspondente Bancário, Administração.
- **Tipos de usuário** (tabela `user_roles`, enum `app_role`): `developer` > `admin` > `sub_admin` > `leader` > `corretor` > `assistente`. Multi-tenant via `organizations` + `profiles.organization_id`.
- **CRM em alto nível**: Kanban com `lead_stages` customizáveis por org, leads em `leads`, histórico em `lead_interactions`, tarefas em `tasks`, notificações em `notifications`. Inativação por inatividade. Score por `lead_score_events`. WhatsApp já cria leads automaticamente via trigger `trg_auto_lead_from_whatsapp`.

## 2. Stack e arquitetura atual

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui. PWA (vite-plugin-pwa).
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions Deno). ~150 edge functions deployadas (lista em §1 da exploração).
- **Banco**: Postgres (Supabase ref `zpajuxxsxrwuqregdzjm`), RLS estrito via `get_user_organization_id()` e `has_role()`. ~180 tabelas em `public`.
- **Auth**: Supabase Auth (email/senha + magic link + passkeys via `webauthn_challenges`/`user_passkeys`). Provisionamento via trigger `handle_new_user`. Controle de sessão (`user_sessions`, máx 2 simultâneas).
- **Hospedagem**: Lovable (frontend SPA) + Supabase (backend) + **VPS OpenClaw** (DevOps, jobs longos, `wa-worker` Baileys). Cloudflare (DNS + Worker para wildcard `*.portadocorretor.com.br`).
- **Serviços externos conectados**:
  - **Cloudinary** (imagens/logos), **Cloudflare R2** (mídia property), **Supabase Storage** (docs)
  - **Meta Ads** (`ad_accounts`, `meta-sync-leads`, `meta-oauth-callback`)
  - **RD Station CRM** (`rd_station_settings`, `rd-station-webhook`, `rd-station-sync-leads`)
  - **Imobzi** (`imobzi-import`, `imobzi-process`)
  - **Retell AI** (voz outbound — pipeline `voice_call_queue` → `retell-trigger-outbound-call` → `retell-webhook`)
  - **ElevenLabs** (TTS para áudio WhatsApp via prefixo `#VOZAI`)
  - **OneSignal** (push notifications)
  - **Upstash Redis** (rate limiting IA — 30 req/h)
  - **Stripe** (`ai-billing-stripe`, `billing-webhook`)
  - **Firecrawl** (scraping marketplace externo)
  - **OpenAI / Anthropic / Gemini / Groq** (via `ai-router` com BYOK)
- **N8N**: padrão "Thin Orchestrator" — n8n só roteia, lógica fica em Edge Functions chamadas via header `X-Webhook-Secret`. Workflows-chave:
  - `HyoHStUv2ZhXnnTG` — atendimento WhatsApp principal (recebe webhook do wa-worker, chama `whatsapp-agent-config`, executa LLM, persiste via `whatsapp-persist-message`)
  - `Fv...` — Retell pós-chamada (qualificação)
  - Auxiliar para mídia/follow-up
- **Redis**: Upstash, exclusivamente para **rate limiting de IA**. Não é usado como fila de mensagens.
- **Evolution API**: **não existe hoje**. O WhatsApp usa **Baileys 6+** rodando como serviço próprio (`wa-worker/`) em VPS Easypanel, com healthcheck HTTP e variáveis `EDGE_BASE_URL`, `WORKER_SECRET`, `INSTANCE_ID`. Uma instância Baileys por organização.
- **Filas/workers/cron/webhooks**:
  - `voice_call_queue` + worker `voice-call-queue-worker` (pg_cron 1min)
  - `follow_up_queue` + `whatsapp-followup-batch` (pg_cron)
  - `automation-monthly-credits` (pg_cron mensal)
  - `check-domains-status` (pg_cron 5min)
  - Triggers SQL: `trg_enqueue_voice_call_fn`, `trg_auto_lead_from_whatsapp`, `handle_new_user`, dedupe de leads
  - Webhooks recebidos: `rd-station-webhook`, `meta-oauth-callback`, `retell-webhook`, `billing-webhook`, `whatsapp-webhook-config` (entrada do wa-worker → n8n)

## 3. Estrutura atual do CRM

- **Lead** (`leads`): pessoa interessada em comprar/alugar/vender, vinculada a uma organização.
- **Campos principais**: `id, organization_id, created_by, broker_id, name, email, phone, lead_stage_id, lead_type_id, source, external_source, external_id, temperature ('frio'|'morno'|'quente'), estimated_value, score, ai_summary, transaction_interest, min/max_bedrooms/bathrooms/area/parking, preferred_neighborhoods[], preferred_cities[], interested_property_type_ids[], position, is_active, inactivation_reason, inactivated_at, consent_voice_call, traffic_source, conversion_identifier, notes, created_at, updated_at`.
- **Etapas do funil**: `lead_stages` (id, name, color, position, is_default, is_win, is_loss) — **customizáveis por org**.
- **Origem**: campo `source` (texto livre: `website`, `meta-ads`, `rd-station`, `whatsapp`, `manual`, `import`, etc.) + `external_source`/`external_id` para rastrear origem externa.
- **Responsável**: `broker_id` (FK profiles). Distribuição automática **não existe formalmente** — é manual/round-robin frágil.
- **Tags**: **não existe tabela de tags**. Há `lead_types` (categorias fixas) e `temperature`, mas tags livres = lacuna.
- **Tarefas**: `tasks` (assigned_to, lead_id, due_date, priority, completed).
- **Observações**: campo `notes` em leads + `lead_interactions` (type: ligacao|email|visita|whatsapp|reuniao|nota, description, occurred_at).
- **Timeline/histórico**: `lead_interactions` + `lead_score_events` + `activity_log` + `audit_events`. Não há view consolidada única.
- **Caixa de entrada / chat unificado**: **parcialmente**. Existe `whatsapp_messages` (mensagens de WhatsApp por instância) e o painel WhatsApp tem chat. **Não existe inbox cross-channel** (ex: ver Instagram + WhatsApp + Messenger no mesmo lugar) — essa é a maior lacuna para o Hub.

## 4. Entrada de leads e integrações atuais

- **Origens implementadas**:
  - **Meta Ads** (Facebook/Instagram Lead Ads): `meta-sync-leads` faz sync via API com cron; ainda **sem webhook real-time** (lacuna). Tabelas `ad_leads`, `ad_accounts`, `ad_entities`.
  - **RD Station CRM**: webhook `rd-station-webhook` + sync `rd-station-sync-leads`. Auto-cria lead no CRM.
  - **Site / Landing Pages**: `website-lead` e `create-site-lead` (edge functions) recebem POST do site white-label e inserem em `leads` com `source='website'`.
  - **Portais (XML)**: saída via `portal-xml-feed` (não recebe leads, só exporta imóveis).
  - **Importação manual**: `crm-import-leads` (CSV/API), tabela `crm_import_logs`.
  - **WhatsApp inbound**: trigger `trg_auto_lead_from_whatsapp` cria lead automaticamente quando chega mensagem de número desconhecido.
  - **Imobzi**: importa contatos como leads via `imobzi-process`.
- **Canais de comunicação ativos hoje**:
  - ✅ **WhatsApp** (Baileys via wa-worker): completo — envio/recebimento de texto, mídia, áudio, fotos de imóveis, agente IA (Sofia), follow-up, transferência humana, welcome rotativo, qualificação por IA, custos por conversa.
  - ✅ **Voz outbound** (Retell): pipeline lead→fila→ligação→qualificação.
  - ✅ **E-mail transacional**: `send-invite-email`, `send-reset-email`, `send-ticket-webhook`.
  - ❌ **Instagram DM**: não existe.
  - ❌ **Messenger (Facebook DM)**: não existe.
  - ❌ **Facebook comentários**: não existe.
  - ❌ **SMS**: não existe.
  - ❌ **E-mail marketing/conversacional bidirecional**: não existe.
  - ❌ **Webchat no site white-label**: não existe (só formulário).

## 5. Sistema de automação atual

- **Tabelas centrais**: `automations` (name, trigger_type, trigger_conditions JSONB, actions JSONB, enabled), `automation_executions` (logs), `automation_credit_wallets` + `automation_credit_transactions` (créditos BRL com markup 1.5x).
- **Páginas**: `src/pages/Automations.tsx` com abas: Automações, Templates, Logs, Score, Agente IA WhatsApp, Follow-up, Voz (Retell).
- **Gatilhos hoje** (inferidos de `AutomationWizard` e `trigger_type`): novo lead, mudança de etapa, lead inativo, mensagem WhatsApp recebida, agendamento criado.
- **Ações hoje**: enviar WhatsApp, criar tarefa, notificar corretor, mover etapa, atribuir broker, ligar via Retell, follow-up programado.
- **Onde fica a lógica**:
  - **Dentro do app** (Edge Functions + triggers SQL): execução de automações, follow-up batch, criação de leads, dedupe, Retell enqueue.
  - **N8n**: orquestração do agente WhatsApp (workflow `HyoHStUv2ZhXnnTG`) e pós-chamada Retell. N8n NÃO contém regras de negócio — só roteia.
- **O que o cliente final configura**:
  - Templates WhatsApp, follow-up (1-10 tentativas, intervalos, horário 08-18 BRT)
  - Prompt do agente IA, modelo (OpenAI/Anthropic/Gemini/Groq), provider
  - Lead score (pesos por evento)
  - Welcome messages rotativas
  - Wizard de automações simples (gatilho + condição + ação)
  - Configuração Retell (em construção — agente Sofia)
- **Limitações atuais**:
  1. **Canal único = WhatsApp**: toda automação assume WhatsApp como canal de saída.
  2. **Sem inbox unificada cross-channel**.
  3. **Sem distribuição automática real** de leads (round-robin/skill-based).
  4. **Wizard de automação rudimentar** — JSONB livre, sem editor visual de fluxo.
  5. **Triggers limitados** — não há gatilho por "comentário em anúncio", "DM Instagram", etc.
  6. **Sem versionamento / A-B test de fluxos**.
  7. **Logs de execução** existem (`automation_executions`) mas sem retry/outbox formal.

## 6. Atendimento humano e operação

- **Quem atende**: o `broker_id` do lead. Se nulo, fica órfão.
- **Distribuição automática**: **não existe formalmente**. Há lógica frágil que pega "primeiro membro da org" (visto em `website-lead/index.ts` linhas 35-45) — claramente um placeholder.
- **Dono do lead**: `leads.broker_id`.
- **Fila**: **não existe fila de atendimento**. Existe fila técnica (`voice_call_queue`, `follow_up_queue`) mas não fila de leads aguardando humano.
- **Múltiplos atendentes por lead**: não modelado. Um lead = um broker.
- **Handoff IA → humano**: `whatsapp-transfer-broker` — IA transfere para humano, envia contexto via WhatsApp ao broker. Lógica em `mem://features/whatsapp/human-handoff-logic`.
- **Status de atendimento**: não existe enum de status de conversa (ex: `aguardando`, `em_atendimento`, `resolvido`). Existe `lead_stages` (funil comercial) mas não status operacional.

## 7. Regras de negócio atuais

- **Distribuição de lead**: manual ou primeiro-membro-da-org. **Não há round-robin/skill/carga.**
- **Mudança de etapa**: manual (drag no Kanban) ou via automação configurada.
- **Criação de tarefa**: manual ou via ação de automação.
- **Notificação ao corretor**: `notifications` insert + push OneSignal + WhatsApp opcional.
- **Bloqueio de automação**: por `enabled=false`, por feature flag, por créditos esgotados (`automation_credit_wallets`).
- **Horário comercial**: hardcoded 08-18 BRT em vários pontos (Retell, follow-up). **Não é configurável por org** — lacuna.
- **Regras por plano**: `useFeatureGate` + `subscription_plans` (slug determina features: `marketplace_access`, `partnership_access`; planos Business/Enterprise = ilimitado).
- **Regras por imobiliária/equipe**: tudo isolado por `organization_id` via RLS. Não há sub-grupos/equipes dentro de uma org.
- **Cooldown / anti-duplicidade**:
  - Dedupe físico de leads via trigger SQL (normaliza `phone`+`email`, bloqueia duplicado por org).
  - Rate limit IA: 30 req/h via Upstash.
  - Welcome WhatsApp: tracking de envio em `whatsapp_welcome_log` para não repetir.
- **Prioridade de canal**: **não existe**. Hoje só WhatsApp.

## 8. Estrutura de dados e banco

**Tabelas-chave existentes (~180 total):**

| Domínio | Tabelas |
|---|---|
| Multi-tenant | `organizations`, `profiles`, `user_roles`, `organization_invites`, `organization_custom_roles` |
| CRM | `leads`, `lead_stages`, `lead_types`, `lead_interactions`, `lead_score_events`, `lead_documents`, `tasks`, `appointments` |
| WhatsApp | `whatsapp_instances`, `whatsapp_messages`, `whatsapp_agent_config`, `whatsapp_welcome_messages`, `whatsapp_welcome_log`, `whatsapp_property_rules`, `whatsapp_audit_log`, `whatsapp_ai_usage` |
| Automação | `automations`, `automation_executions`, `automation_credit_wallets`, `automation_credit_transactions`, `follow_up_queue`, `follow_up_log` |
| Voz | `voice_calls`, `voice_call_queue`, `retell_agent_config`, `retell_flow_steps` |
| Integrações | `ad_accounts`, `ad_entities`, `ad_insights_daily`, `ad_leads`, `ad_settings`, `rd_station_settings`, `rd_station_webhook_logs`, `imobzi_settings`, `imobzi_api_keys` |
| IA | `ai_router_config`, `ai_router_logs`, `ai_provider_config`, `ai_qualification_config`, `ai_credit_wallets`, `ai_token_usage_events`, `ai_org_budgets` |
| Comercial | `subscription_plans`, `subscriptions`, `billing_payments`, `plan_modules`, `custom_plan_selections` |
| Notificação | `notifications`, `push_subscriptions`, `user_devices` |

**Reaproveitáveis para o Hub:**
- `automations` + `automation_executions` → motor genérico (já é JSONB)
- `whatsapp_messages` → modelo de **mensagem unificada** (precisa generalizar para `channel`)
- `lead_interactions` → timeline cross-channel (já tem `type` enum extensível)
- `automation_credit_wallets` → cobrança por execução cross-channel
- `ai_router_*` → IA agnóstica de canal já pronta

**Lacunas críticas no banco:**
1. **Sem tabela `channels`/`channel_accounts`** — cada canal está em silo (`whatsapp_instances` só serve WhatsApp).
2. **Sem `conversations`** — agrupamento de mensagens por lead+canal não existe; hoje é `(remote_jid, instance_name)` direto em `whatsapp_messages`.
3. **Sem `messages` genérica** — só `whatsapp_messages`. Para Instagram/Messenger seria preciso uma tabela polimórfica ou nova.
4. **Sem `inbox_assignments`** — quem está atendendo qual conversa.
5. **Sem `tags`** livres em leads/conversas.
6. **Sem `business_hours` por org** configurável.
7. **Sem `team`/`group`** dentro de organização (para distribuição).
8. **`automations.trigger_type` é `text` livre** — sem catálogo formal.

## 9. Permissões e comercialização

- **Quem configura**: `Integrations.tsx` exige `isAdminOrAbove` (admin/sub_admin/developer). `Automations.tsx` é acessível a corretores+, mas configuração avançada via FeatureFlagGate (`has_whatsapp`).
- **Perfis**: developer (super), admin (org), sub_admin, leader (gerente), corretor, assistente (read-only).
- **Separação por plano**: `subscription_plans` com 25 planos cadastrados. Add-ons existentes:
  - `addon-whatsapp` (WhatsApp Connect)
  - `addon-automations` (Automacoes Pro)
  - `addon-ia-extra` (Pacote IA Extra)
  - Combos `combo-business`, `combo-enterprise` incluem tudo.
- **Hub seria premium?** **Recomendação**: sim, novo add-on `addon-omnichannel-hub` ou bundled em `business`/`enterprise`. Já existe infra (`useFeatureGate`, `plan_modules`) para gating.
- **Limites existentes**: créditos BRL em `automation_credit_wallets`, tokens IA em `ai_org_budgets`, máx 2 sessões.

## 10. UX atual e UX desejável

- **Hoje** o usuário navega:
  - **CRM** (`/crm`) — Kanban + tabs Inativos/Templates WhatsApp
  - **Automações** (`/automations`) — 7 abas (Automações/Templates/Logs/Score/Agente WhatsApp/Follow-up/Retell)
  - **Integrações** (`/integrations`) — Imobzi, Portais XML, histórico de sync
  - WhatsApp tem painel próprio dentro de Automações (não é menu top-level)
- **Telas existentes relevantes ao Hub**:
  - `WhatsAppAgentPanel`, `RetellVoicePanel`, `FollowUpConfigPanel`, `AutomationWizard`, `AutomationExecutionLog`
- **Encaixe natural do Hub**:
  - Novo item de menu top-level: **"Hub de Automação"** ou **"Conversas"** (consolidando inbox + automação cross-channel)
  - Manter `/automations` como motor (regras), criar `/inbox` para inbox unificada
- **Telas que precisariam existir**:
  1. **Inbox unificada** — lista de conversas filtrada por canal/status/atendente
  2. **Detalhe da conversa** — timeline cross-channel + lead embutido
  3. **Conexão de canais** — wizard para conectar Instagram/Messenger/Facebook (OAuth Meta)
  4. **Editor visual de fluxo** — substituir `AutomationWizard` por canvas (tipo n8n leve, ReactFlow)
  5. **Distribuição & equipes** — configurar round-robin/skill/horário por equipe
  6. **Catálogo de gatilhos/ações** — por canal
  7. **Templates por canal** — não só WhatsApp

## 11. MVP recomendado

**MVP (Fase 1 — 4-6 semanas):**
1. **Generalizar modelo de mensagem**: criar tabelas `channel_accounts`, `conversations`, `messages` (polimórficas) — migrar `whatsapp_messages` para nova estrutura via view de compatibilidade.
2. **Inbox unificada** (UI): primeira versão só com WhatsApp (canal já maduro), arquitetada para multi-canal.
3. **Conexão Instagram DM + Messenger** via Meta Graph API (OAuth já existe parcialmente — `meta-oauth-callback`). Usar mesmo padrão de webhook.
4. **Catálogo formal de triggers/actions** (substituir `trigger_type text` por enum + tabela `automation_trigger_catalog`).
5. **Distribuição automática básica** — round-robin por org com fallback (resolver placeholder de `website-lead`).
6. **Gating comercial** — novo add-on `addon-omnichannel-hub`.

**Fase 2 (depois):**
- Editor visual de fluxo (ReactFlow)
- Facebook comentários (mais complexo — precisa polling ou webhook de página)
- SMS (Twilio connector)
- Webchat embedável no site white-label
- Equipes/skills
- Horário comercial por org configurável
- Outbox/retry para confiabilidade
- A/B test de fluxos

**Riscos técnicos:**
- Meta Business Verification para Instagram/Messenger (cliente precisa verificar conta — fricção alta)
- WhatsApp via Baileys é não-oficial; escalar para 1000+ instâncias exigirá orquestrador (Kubernetes ou WhatsApp Cloud API oficial)
- Migração de `whatsapp_messages` é cirurgia em tabela viva — exige view de compat + dual-write
- N8n como orquestrador de múltiplos canais = pode virar gargalo; talvez mover orquestração para edge function

**Riscos funcionais:**
- Cliente espera "ferramenta tipo Manychat" → expectativa de editor visual (Fase 2 vira crítico)
- Distribuição automática é política sensível (corretores brigam por leads) — precisa auditoria/relatório
- LGPD: opt-in por canal (consent_voice_call existe; falta `consent_whatsapp_marketing`, `consent_email_marketing`)

## 12. Conclusão objetiva

**Já pronto como base:**
- Multi-tenant + RLS sólido
- Motor de automação genérico (`automations` JSONB + `automation_executions`)
- WhatsApp completo (Baileys + agente IA + follow-up + handoff + créditos)
- Sistema de créditos BRL com markup já operando
- Pipeline Retell voz (mesmo padrão se aplica a outros canais)
- Roteador IA multi-provider (`ai-router`)
- Integrações Meta Ads e RD Station (OAuth Meta já existe)
- N8n com padrão "Thin Orchestrator" estabelecido
- Feature gating por plano

**Precisa ser criado:**
- Tabelas `channel_accounts`, `conversations`, `messages` genéricas
- Tabelas `inbox_assignments`, `tags`, `teams`, `business_hours`, `consent_per_channel`
- UI de Inbox unificada
- Conectores Instagram DM, Messenger, Facebook comentários (via Meta Graph)
- Catálogo formal de triggers/actions por canal
- Distribuição automática real (round-robin/skill)
- Editor visual de fluxo (Fase 2)
- Add-on comercial `addon-omnichannel-hub`

**Precisa refatorar antes:**
- `whatsapp_messages` → migrar para `messages` genérica com view de compat
- `website-lead` placeholder de `created_by` (pega "primeiro membro" — bug de produção)
- `automations.trigger_type text` → enum/catálogo
- Horários hardcoded → `business_hours` por org
- N8n workflow `HyoHStUv2ZhXnnTG` aceitar canal genérico, não só WhatsApp

---

## Resumo executivo para implementação do Hub

**O Porta do Corretor já tem 70% da infraestrutura para um Hub Omnichannel**: multi-tenant blindado, motor de automação JSONB com créditos BRL, WhatsApp ponta-a-ponta com IA, integração Meta Ads/RD Station, roteador IA multi-provider, pipeline de voz (Retell) que serve de molde para qualquer canal assíncrono.

**Os 30% que faltam são estruturais, não cosméticos**: hoje tudo gira em torno de `whatsapp_messages` — não existe um conceito unificado de "conversa" nem "canal". Sem isso, adicionar Instagram/Messenger vira gambiarra. A primeira tarefa do Hub é criar 3 tabelas (`channel_accounts`, `conversations`, `messages`) e migrar WhatsApp para esse modelo via view de compatibilidade, sem quebrar nada.

**Estratégia recomendada**: lançar MVP em ~5 semanas só com WhatsApp na nova arquitetura + Inbox unificada + Instagram DM (canal Meta mais fácil, OAuth já existe). Vender como add-on `addon-omnichannel-hub` ou bundle Business/Enterprise. Deixar editor visual de fluxo, Facebook comentários, SMS e webchat para Fase 2.

**Maior risco**: WhatsApp via Baileys (não-oficial) não escala para 10k+ orgs — em algum momento vai precisar migrar para WhatsApp Cloud API oficial (Meta). Não bloqueia MVP, mas precisa estar no radar.

**Maior oportunidade**: o cliente final hoje só configura coisas pontuais (templates, follow-up, prompt). Um editor visual de fluxo cross-channel é o que transforma o produto de "CRM com WhatsApp" em "plataforma de automação imobiliária" — é o diferencial competitivo real vs. RD Station / Kommo.

<lov-actions>
<lov-suggestion message="Crie um plano detalhado da Fase 1 do Hub Omnichannel: migração de whatsapp_messages para tabelas genéricas (channel_accounts, conversations, messages) com view de compatibilidade, sem quebrar nada em produção.">Plano da migração para messages genérica</lov-suggestion>
<lov-suggestion message="Desenhe o schema completo das novas tabelas channel_accounts, conversations, messages, inbox_assignments e tags, com RLS, triggers e relacionamento com leads e organizations.">Desenhar schema do Hub</lov-suggestion>
<lov-suggestion message="Implemente a integração de Instagram Direct Messages reutilizando o OAuth Meta já existente (meta-oauth-callback). Inclua webhook de recebimento e edge function de envio.">Conectar Instagram DM</lov-suggestion>
<lov-suggestion message="Crie um wireframe/protótipo HTML da Inbox unificada (lista de conversas + detalhe + filtros por canal/status/atendente) seguindo o design system atual.">Protótipo da Inbox unificada</lov-suggestion>
<lov-suggestion message="Implemente distribuição automática real de leads (round-robin com fallback e respeito a horário) substituindo o placeholder atual em website-lead que pega o primeiro membro da org.">Distribuição automática de leads</lov-suggestion>
</lov-actions>O `plan--create` falhou (esquema desconhecido) mas como esta tarefa é uma **auditoria/pesquisa** e não uma implementação, não preciso de plano. Entrego o relatório direto:

---

# Auditoria Técnica — Hub de Automação Omnichannel (Porta do Corretor)

## 1. Visão geral do sistema

- **O que é**: ERP/CRM imobiliário SaaS multi-tenant white-label (Habitae / Porta do Corretor) para imobiliárias e corretores. Domínio principal: `portadocorretor.com.br`.
- **Módulos existentes**: Dashboard, Imóveis, CRM (Kanban), Contratos, Financeiro, Marketplace inter-imobiliárias, Automações, Agenda, Integrações, Site Builder white-label, Anúncios (gerador de criativos), Correspondente Bancário, Administração.
- **Tipos de usuário** (tabela `user_roles`, enum `app_role`): `developer` > `admin` > `sub_admin` > `leader` > `corretor` > `assistente`. Multi-tenant via `organizations` + `profiles.organization_id`.
- **CRM em alto nível**: Kanban com `lead_stages` customizáveis por org, leads em `leads`, histórico em `lead_interactions`, tarefas em `tasks`, notificações em `notifications`. Inativação por inatividade. Score por `lead_score_events`. WhatsApp já cria leads automaticamente via trigger `trg_auto_lead_from_whatsapp`.

## 2. Stack e arquitetura atual

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui. PWA.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions Deno). ~150 edge functions deployadas.
- **Banco**: Postgres (ref `zpajuxxsxrwuqregdzjm`), RLS estrito via `get_user_organization_id()` e `has_role()`. ~180 tabelas em `public`.
- **Auth**: Supabase Auth (email/senha + magic link + passkeys via `webauthn_challenges`/`user_passkeys`). Provisionamento via trigger `handle_new_user`. Máx 2 sessões simultâneas (`user_sessions`).
- **Hospedagem**: Lovable (frontend) + Supabase (backend) + **VPS OpenClaw** (DevOps, jobs longos, `wa-worker` Baileys). Cloudflare (DNS + Worker para wildcard `*.portadocorretor.com.br`).
- **Serviços externos**: Cloudinary, Cloudflare R2, Meta Ads, RD Station, Imobzi, Retell AI, ElevenLabs, OneSignal, Upstash Redis, Stripe, Firecrawl, OpenAI/Anthropic/Gemini/Groq via `ai-router`.
- **N8N**: padrão "Thin Orchestrator" — só roteia, lógica fica em Edge Functions chamadas via header `X-Webhook-Secret`. Workflow principal WhatsApp: `HyoHStUv2ZhXnnTG`. Pós-chamada Retell: `Fv...`.
- **Redis (Upstash)**: exclusivamente para **rate limiting de IA** (30 req/h). **Não é fila de mensagens.**
- **Evolution API**: **não existe hoje**. WhatsApp usa **Baileys 6+** rodando como serviço próprio (`wa-worker/`) em VPS Easypanel. Uma instância Baileys por organização.
- **Filas/workers/cron/webhooks ativos**:
  - `voice_call_queue` + `voice-call-queue-worker` (pg_cron 1min)
  - `follow_up_queue` + `whatsapp-followup-batch` (pg_cron)
  - `automation-monthly-credits` (mensal), `check-domains-status` (5min)
  - Triggers SQL: `trg_enqueue_voice_call_fn`, `trg_auto_lead_from_whatsapp`, `handle_new_user`, dedupe leads
  - Webhooks recebidos: `rd-station-webhook`, `meta-oauth-callback`, `retell-webhook`, `billing-webhook`, `whatsapp-webhook-config`

## 3. Estrutura atual do CRM

- **Lead** = pessoa interessada em comprar/alugar/vender, vinculada a uma organização.
- **Campos principais** (`leads`): `id, organization_id, created_by, broker_id, name, email, phone, lead_stage_id, lead_type_id, source, external_source, external_id, temperature ('frio'|'morno'|'quente'), estimated_value, score, ai_summary, transaction_interest, min/max_bedrooms/bathrooms/area/parking, preferred_neighborhoods[], preferred_cities[], interested_property_type_ids[], position, is_active, inactivation_reason, inactivated_at, consent_voice_call, traffic_source, conversion_identifier, notes, created_at, updated_at`.
- **Etapas do funil**: `lead_stages` (name, color, position, is_default, is_win, is_loss) — **customizáveis por org**.
- **Origem**: campo `source` (texto livre) + `external_source`/`external_id` para rastrear.
- **Responsável**: `broker_id` (FK profiles).
- **Tags**: **não existe tabela de tags livres**. Há `lead_types` (categorias fixas) e `temperature`. Lacuna.
- **Tarefas**: `tasks` (assigned_to, lead_id, due_date, priority, completed).
- **Observações**: `leads.notes` + `lead_interactions` (type: ligacao|email|visita|whatsapp|reuniao|nota).
- **Timeline**: `lead_interactions` + `lead_score_events` + `activity_log` + `audit_events` — **sem view consolidada única**.
- **Caixa de entrada / chat unificado**: **parcial**. Existe `whatsapp_messages` e painel de chat WhatsApp. **Não existe inbox cross-channel** — maior lacuna para o Hub.

## 4. Entrada de leads e integrações atuais

**Origens implementadas:**
- **Meta Ads** (Facebook/Instagram Lead Ads): `meta-sync-leads` via API com cron; **sem webhook real-time** (lacuna). Tabelas `ad_leads`, `ad_accounts`, `ad_entities`.
- **RD Station CRM**: webhook `rd-station-webhook` + sync `rd-station-sync-leads`. Auto-cria lead.
- **Site / Landing Pages**: edge functions `website-lead` e `create-site-lead` recebem POST e inserem com `source='website'`.
- **Portais (XML)**: `portal-xml-feed` só **exporta** imóveis, não recebe leads.
- **Importação manual**: `crm-import-leads` (CSV/API), tabela `crm_import_logs`.
- **WhatsApp inbound**: trigger `trg_auto_lead_from_whatsapp` cria lead quando chega mensagem de número desconhecido.
- **Imobzi**: importa contatos como leads via `imobzi-process`.

**Canais de comunicação ativos:**
- ✅ **WhatsApp** (Baileys via wa-worker): completo — texto, mídia, áudio, fotos de imóveis, agente IA Sofia, follow-up, transferência humana, welcome rotativo, qualificação por IA, custos por conversa.
- ✅ **Voz outbound** (Retell): pipeline lead→fila→ligação→qualificação.
- ✅ **E-mail transacional**: `send-invite-email`, `send-reset-email`, `send-ticket-webhook`.
- ❌ **Instagram DM**: não existe.
- ❌ **Messenger (Facebook DM)**: não existe.
- ❌ **Facebook comentários**: não existe.
- ❌ **SMS**: não existe.
- ❌ **E-mail conversacional bidirecional**: não existe.
- ❌ **Webchat no site white-label**: não existe (só formulário).

## 5. Sistema de automação atual

- **Tabelas centrais**: `automations` (name, trigger_type text, trigger_conditions JSONB, actions JSONB, enabled), `automation_executions` (logs), `automation_credit_wallets` + `automation_credit_transactions` (créditos BRL com markup 1.5x).
- **UI**: `src/pages/Automations.tsx` com 7 abas: Automações, Templates, Logs, Score, Agente IA WhatsApp, Follow-up, Voz (Retell).
- **Gatilhos hoje** (inferidos do `AutomationWizard`): novo lead, mudança de etapa, lead inativo, mensagem WhatsApp recebida, agendamento criado.
- **Ações hoje**: enviar WhatsApp, criar tarefa, notificar corretor, mover etapa, atribuir broker, ligar via Retell, follow-up programado.
- **Onde fica a lógica**:
  - **App** (Edge Functions + triggers SQL): execução de automações, follow-up, criação de leads, dedupe, Retell enqueue.
  - **N8n**: orquestração do agente WhatsApp (`HyoHStUv2ZhXnnTG`) e pós-chamada Retell. **Não contém regras de negócio.**
- **O cliente configura**: templates WhatsApp, follow-up (1-10 tentativas, intervalos, horário 08-18 BRT), prompt do agente IA, modelo/provider, lead score, welcome rotativo, wizard simples de automação, agente Retell Sofia (em construção).
- **Limitações**:
  1. **Canal único = WhatsApp** em todas as automações.
  2. **Sem inbox unificada cross-channel.**
  3. **Sem distribuição automática real** (round-robin/skill-based).
  4. **Wizard rudimentar** — JSONB livre, sem editor visual de fluxo.
  5. **Triggers limitados** — não há gatilho por "comentário em anúncio", "DM Instagram", etc.
  6. **Sem versionamento / A-B test de fluxos.**
  7. **Sem outbox/retry formal** (existe log mas não retry automático).

## 6. Atendimento humano e operação

- **Quem atende**: o `broker_id` do lead. Se nulo, fica órfão.
- **Distribuição automática**: **não existe formalmente**. Há lógica frágil que pega "primeiro membro da org" — visível em `supabase/functions/website-lead/index.ts` (linhas ~36-45, claramente placeholder).
- **Dono do lead**: `leads.broker_id`.
- **Fila de atendimento**: **não existe**. Existem filas técnicas (`voice_call_queue`, `follow_up_queue`) mas não fila de leads aguardando humano.
- **Múltiplos atendentes por lead**: não modelado. Um lead = um broker.
- **Handoff IA → humano**: `whatsapp-transfer-broker` envia contexto via WhatsApp ao broker.
- **Status de atendimento**: **não existe enum** (ex: `aguardando`, `em_atendimento`, `resolvido`). Existe `lead_stages` (funil comercial) mas não status operacional de conversa.

## 7. Regras de negócio atuais

- **Distribuição de lead**: manual ou primeiro-membro-da-org (placeholder).
- **Mudança de etapa**: manual (Kanban) ou via automação configurada.
- **Criação de tarefa**: manual ou ação de automação.
- **Notificação**: insert em `notifications` + push OneSignal + WhatsApp opcional.
- **Bloqueio de automação**: `enabled=false`, feature flag, créditos esgotados.
- **Horário comercial**: hardcoded 08-18 BRT em vários pontos. **Não configurável por org** — lacuna.
- **Regras por plano**: `useFeatureGate` + `subscription_plans` (slug determina features; Business/Enterprise = ilimitado).
- **Regras por imobiliária/equipe**: tudo isolado por `organization_id` via RLS. **Sem sub-equipes** dentro de uma org.
- **Cooldown / anti-duplicidade**:
  - Dedupe físico de leads via trigger SQL (normaliza phone+email).
  - Rate limit IA: 30 req/h via Upstash.
  - Welcome WhatsApp: tracking em `whatsapp_welcome_log`.
- **Prioridade de canal**: **não existe** (só WhatsApp).

## 8. Estrutura de dados e banco

**Tabelas-chave (~180 total):**

| Domínio | Tabelas |
|---|---|
| Multi-tenant | `organizations`, `profiles`, `user_roles`, `organization_invites` |
| CRM | `leads`, `lead_stages`, `lead_types`, `lead_interactions`, `lead_score_events`, `lead_documents`, `tasks`, `appointments` |
| WhatsApp | `whatsapp_instances`, `whatsapp_messages`, `whatsapp_agent_config`, `whatsapp_welcome_messages/log`, `whatsapp_property_rules`, `whatsapp_audit_log`, `whatsapp_ai_usage` |
| Automação | `automations`, `automation_executions`, `automation_credit_wallets/transactions`, `follow_up_queue`, `follow_up_log` |
| Voz | `voice_calls`, `voice_call_queue`, `retell_agent_config`, `retell_flow_steps` |
| Integrações | `ad_accounts`, `ad_entities`, `ad_leads`, `rd_station_settings`, `rd_station_webhook_logs`, `imobzi_settings` |
| IA | `ai_router_config`, `ai_router_logs`, `ai_provider_config`, `ai_qualification_config`, `ai_credit_wallets`, `ai_org_budgets` |
| Comercial | `subscription_plans`, `subscriptions`, `billing_payments`, `plan_modules` |
| Notificação | `notifications`, `push_subscriptions`, `user_devices` |

**Reaproveitáveis para o Hub:**
- `automations` + `automation_executions` → motor genérico (já é JSONB)
- `whatsapp_messages` → modelo de mensagem (precisa generalizar com `channel`)
- `lead_interactions` → timeline cross-channel (enum já extensível)
- `automation_credit_wallets` → cobrança cross-channel
- `ai_router_*` → IA agnóstica de canal já pronta

**Lacunas críticas no banco:**
1. **Sem `channel_accounts`** — cada canal está em silo.
2. **Sem `conversations`** — agrupamento de mensagens por lead+canal não existe.
3. **Sem `messages` genérica** — só `whatsapp_messages`.
4. **Sem `inbox_assignments`** — quem atende o quê.
5. **Sem `tags`** livres.
6. **Sem `business_hours`** por org configurável.
7. **Sem `teams`/`groups`** dentro de organização.
8. **`automations.trigger_type` é `text` livre** — sem catálogo formal.
9. **Sem `consent_*` por canal** (só `consent_voice_call` existe).

## 9. Permissões e comercialização

- **Quem configura**: `Integrations.tsx` exige `isAdminOrAbove`. `Automations.tsx` acessível a corretores+, configuração avançada via `FeatureFlagGate('has_whatsapp')`.
- **Perfis**: developer (super), admin (org), sub_admin, leader, corretor, assistente (read-only).
- **Separação por plano**: 25 planos cadastrados. Add-ons existentes:
  - `addon-whatsapp` (WhatsApp Connect)
  - `addon-automations` (Automacoes Pro)
  - `addon-ia-extra` (Pacote IA Extra)
  - Combos `combo-business`, `combo-enterprise` incluem tudo.
- **Hub seria premium?** **Recomendação**: novo add-on `addon-omnichannel-hub` ou bundled em Business/Enterprise. Infra de gating já existe.
- **Limites existentes**: créditos BRL em `automation_credit_wallets`, tokens IA em `ai_org_budgets`, máx 2 sessões.

## 10. UX atual e UX desejável

- **Hoje**:
  - **CRM** (`/crm`) — Kanban + tabs Inativos/Templates WhatsApp
  - **Automações** (`/automations`) — 7 abas
  - **Integrações** (`/integrations`) — Imobzi, Portais XML, sync
  - WhatsApp dentro de Automações (não é menu top-level)
- **Telas existentes relevantes**: `WhatsAppAgentPanel`, `RetellVoicePanel`, `FollowUpConfigPanel`, `AutomationWizard`, `AutomationExecutionLog`.
- **Encaixe natural do Hub**:
  - Novo menu top-level: **"Conversas"** (inbox) + **"Hub de Automação"** (motor)
  - Manter `/automations` como motor de regras, criar `/inbox` para inbox unificada
- **Telas que precisariam existir**:
  1. **Inbox unificada** — lista de conversas filtrada por canal/status/atendente
  2. **Detalhe da conversa** — timeline cross-channel + lead embutido
  3. **Conexão de canais** — wizard OAuth Meta para Instagram/Messenger/Facebook
  4. **Editor visual de fluxo** — substituir `AutomationWizard` por canvas (ReactFlow)
  5. **Distribuição & equipes** — round-robin/skill/horário por equipe
  6. **Catálogo de gatilhos/ações** por canal
  7. **Templates por canal** (não só WhatsApp)

## 11. MVP recomendado

**MVP Fase 1 (~5 semanas):**
1. **Generalizar modelo de mensagem**: criar `channel_accounts`, `conversations`, `messages` (polimórficas) — migrar `whatsapp_messages` via view de compatibilidade (sem dual-write quebrando).
2. **Inbox unificada** (UI): primeira versão só WhatsApp (canal maduro), arquitetada multi-canal.
3. **Conexão Instagram DM + Messenger** via Meta Graph API (OAuth Meta já parcialmente existente em `meta-oauth-callback`).
4. **Catálogo formal de triggers/actions** (substituir `trigger_type text` por enum).
5. **Distribuição automática básica** — round-robin por org (resolve placeholder de `website-lead`).
6. **Gating comercial** — add-on `addon-omnichannel-hub`.

**Fase 2 (depois):**
- Editor visual de fluxo (ReactFlow)
- Facebook comentários (polling ou webhook de página)
- SMS (Twilio connector)
- Webchat embedável
- Equipes/skills, horário comercial por org, outbox/retry, A/B test.

**Riscos técnicos:**
- Meta Business Verification para Instagram/Messenger (fricção alta para o cliente final).
- WhatsApp via Baileys é não-oficial; escalar exigirá migração para WhatsApp Cloud API.
- Migração de `whatsapp_messages` em tabela viva — exige view de compat.
- N8n como orquestrador multi-canal pode virar gargalo.

**Riscos funcionais:**
- Cliente espera "tipo Manychat" → expectativa de editor visual (Fase 2 vira crítico).
- Distribuição automática é política sensível — precisa auditoria.
- LGPD: opt-in por canal (falta `consent_whatsapp_marketing`, `consent_email_marketing`).

## 12. Conclusão objetiva

**Já pronto como base:**
- Multi-tenant + RLS sólido
- Motor de automação genérico (`automations` JSONB + execuções)
- WhatsApp completo (Baileys + IA + follow-up + handoff + créditos)
- Sistema de créditos BRL com markup
- Pipeline Retell voz (mesmo padrão se aplica a outros canais)
- Roteador IA multi-provider
- Integrações Meta Ads e RD Station (OAuth Meta existe)
- N8n com padrão "Thin Orchestrator" estabelecido
- Feature gating por plano

**Precisa ser criado:**
- Tabelas `channel_accounts`, `conversations`, `messages` genéricas
- `inbox_assignments`, `tags`, `teams`, `business_hours`, `consent_per_channel`
- UI de Inbox unificada
- Conectores Instagram DM, Messenger, Facebook comentários (Meta Graph)
- Catálogo formal de triggers/actions por canal
- Distribuição automática real
- Editor visual de fluxo (Fase 2)
- Add-on comercial `addon-omnichannel-hub`

**Precisa refatorar antes:**
- `whatsapp_messages` → migrar para `messages` genérica (com view de compat)
- `website-lead` placeholder de `created_by` (bug: pega "primeiro membro" da org)
- `automations.trigger_type text` → enum/catálogo
- Horários hardcoded → `business_hours` por org
- Workflow N8n `HyoHStUv2ZhXnnTG` aceitar canal genérico

---

## Resumo executivo para implementação do Hub

**O Porta do Corretor já tem ~70% da infraestrutura para um Hub Omnichannel**: multi-tenant blindado, motor de automação JSONB com créditos BRL operando, WhatsApp ponta-a-ponta com IA, integração Meta Ads/RD Station, roteador IA multi-provider, pipeline de voz (Retell) que serve de molde para qualquer canal assíncrono.

**Os 30% que faltam são estruturais, não cosméticos**: hoje tudo gira em torno de `whatsapp_messages` — não existe um conceito unificado de "conversa" nem "canal". Sem isso, adicionar Instagram/Messenger vira gambiarra. A primeira tarefa do Hub é criar 3 tabelas (`channel_accounts`, `conversations`, `messages`) e migrar WhatsApp para esse modelo via view de compatibilidade, sem quebrar nada em produção.

**Estratégia recomendada**: lançar MVP em ~5 semanas com WhatsApp na nova arquitetura + Inbox unificada + Instagram DM (canal Meta mais fácil, OAuth já existe). Vender como add-on `addon-omnichannel-hub` ou bundle Business/Enterprise. Deixar editor visual de fluxo, Facebook comentários, SMS e webchat para Fase 2.

**Maior risco**: WhatsApp via Baileys (não-oficial) não escala para 10k+ orgs — em algum momento vai precisar migrar para WhatsApp Cloud API oficial. Não bloqueia MVP, mas precisa estar no radar.

**Maior oportunidade**: o cliente final hoje só configura coisas pontuais (templates, follow-up, prompt). Um editor visual de fluxo cross-channel é o que transforma o produto de "CRM com WhatsApp" em "plataforma de automação imobiliária" — diferencial competitivo real vs. RD Station / Kommo.

<lov-actions>
<lov-suggestion message="Crie um plano detalhado da Fase 1 do Hub Omnichannel: migração de whatsapp_messages para tabelas genéricas (channel_accounts, conversations, messages) com view de compatibilidade, sem quebrar nada em produção.">Plano da migração para messages genérica</lov-suggestion>
<lov-suggestion message="Desenhe o schema completo das novas tabelas channel_accounts, conversations, messages, inbox_assignments e tags, com RLS, triggers e relacionamento com leads e organizations.">Desenhar schema do Hub</lov-suggestion>
<lov-suggestion message="Implemente a integração de Instagram Direct Messages reutilizando o OAuth Meta já existente (meta-oauth-callback). Inclua webhook de recebimento e edge function de envio.">Conectar Instagram DM</lov-suggestion>
<lov-suggestion message="Crie um wireframe/protótipo HTML da Inbox unificada (lista de conversas + detalhe + filtros por canal/status/atendente) seguindo o design system atual.">Protótipo da Inbox unificada</lov-suggestion>
<lov-suggestion message="Implemente distribuição automática real de leads (round-robin com fallback e respeito a horário comercial) substituindo o placeholder atual em website-lead que pega o primeiro membro da org.">Distribuição automática de leads</lov-suggestion>
</lov-actions>