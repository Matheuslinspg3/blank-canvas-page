# Auditoria de Confiabilidade, Segurança e Resiliência
**Data:** 2026-03-23 | **Foco:** Dependências externas, falhas, integridade, permissões, abuso

---

## Diagnóstico Geral

O app possui uma base de segurança sólida (RLS em 89 tabelas, rate limiting em IA, admin_allowlist, audit_events). Porém, existem **lacunas críticas em 5 áreas**:

1. **`send-reset-email` sem rate limiting** — endpoint público, abusável para spam/billing
2. **Limites de plano sem enforcement no banco** — frontend checa mas não bloqueia
3. **58 Edge Functions com `verify_jwt=false` sem validação manual** — superfície de ataque
4. **Fetches externos sem timeout em ~15 functions** — penduradas até 150s
5. **Sem circuit breaker para integrações externas** — falha cascata

---

## Problemas Identificados

### 🔴 P1 — `send-reset-email` sem rate limiting (CRÍTICO)

- **Problema:** Endpoint público (`verify_jwt=false`) aceita qualquer email sem limitar frequência. Atacante pode invocar milhares de vezes.
- **Impacto no usuário:** Inbox flood para o alvo; reputação do domínio `portadocorretor.com.br` degradada.
- **Impacto no negócio:** Quota do Resend consumida ($); domínio pode ser blacklisted.
- **Impacto na operação:** Sem alerta; difícil detectar.
- **Causa:** Função criada sem considerar abuse path.
- **Solução:** Rate limit no banco — máximo 5 resets por email por 15 minutos.
- **Frontend:** Nenhuma mudança.
- **Backend:** Adicionar check de rate limit antes de `generateLink`.
- **Banco:** Usar tabela `auth.users` (last reset) ou contador in-memory via KV.
- **Integrações:** Protege quota Resend.
- **Esforço:** Baixo | **Prioridade:** Alta

### 🔴 P2 — Limites de plano sem enforcement no banco

- **Problema:** `max_leads`, `max_own_properties`, `max_users` existem em `subscription_plans` mas são checados apenas no frontend. Chamada direta ao Supabase ignora o limite.
- **Impacto no usuário:** Nenhum imediato (beneficia quem burla).
- **Impacto no negócio:** Receita perdida; planos gratuitos usados como premium.
- **Impacto na operação:** Storage/egress crescem sem receita correspondente.
- **Causa:** Limites definidos como metadata mas sem trigger de enforcement.
- **Solução:** Trigger `BEFORE INSERT` em `leads` e `properties` que verifica contagem vs. plano.
- **Frontend:** Manter checks para UX (mensagem amigável); banco é última barreira.
- **Backend:** Nenhuma mudança.
- **Banco:** Trigger function + policies.
- **Integrações:** Nenhuma.
- **Esforço:** Médio | **Prioridade:** Alta

### 🟡 P3 — 35+ Edge Functions com `verify_jwt=false` sem auth manual

- **Problema:** Já mapeadas 58 functions com jwt desabilitado. Algumas (ai-router, summarize-lead) fazem auth manual via `getUser()` ou `getClaims()`. Mas outras como `onesignal-app-id`, `meta-app-id`, `rd-station-app-id`, `cloudflare-purge-cache` não verificam identidade.
- **Impacto:** Functions de app-id expõem IDs públicos (risco baixo). Mas `cloudflare-purge-cache`, `toggle-maintenance-mode`, `admin-subscriptions` sem JWT são superfície de ataque se não validam internamente.
- **Causa:** Pattern de JWT bypass por incompatibilidade ES256 aplicado em massa.
- **Solução:** Auditar cada function; as que manipulam dados devem ter `getUser()` + role check.
- **Esforço:** Médio | **Prioridade:** Alta

### 🟡 P4 — Fetches externos sem timeout em ~15 functions

- **Problema:** Functions como `generate-ad-content`, `generate-ad-image`, `billing`, `meta-sync-*` fazem `fetch()` sem `AbortController` ou `AbortSignal.timeout()`.
- **Impacto:** Function fica pendurada até 150s; consome invocação do plano sem resultado.
- **Causa:** Pattern não padronizado; algumas functions já usam timeout (imobzi-import, list-ai-models), mas maioria não.
- **Solução:** `_shared/fetch.ts` com `fetchWithTimeout()` reutilizável.
- **Esforço:** Baixo | **Prioridade:** Alta

### 🟡 P5 — Sem circuit breaker para providers externos

- **Problema:** Se Asaas, Meta ou Resend ficam fora do ar, cada request tenta e falha individualmente. Não há circuito que "abre" após N falhas consecutivas.
- **Impacto:** Latência acumulada; quota de invocações consumida sem resultado.
- **Causa:** Pattern não implementado.
- **Solução:** `ai-router` já tem algo similar (`consecutive_errors` + penalização). Generalizar para outros providers.
- **Esforço:** Médio | **Prioridade:** Média

### 🟡 P6 — Deleção de imóvel não-atômica

- **Problema:** `deleteProperty` em `useProperties.ts` faz 4 DELETEs sequenciais sem transação.
- **Impacto:** Falha parcial deixa orphans (imagens sem imóvel, owners sem property).
- **Causa:** Frontend não tem acesso a transações SQL.
- **Solução:** RPC `delete_property_cascade()` com BEGIN/COMMIT.
- **Esforço:** Baixo | **Prioridade:** Alta

### 🟡 P7 — OAuth tokens Meta/RD Station em texto plano

- **Problema:** `ad_accounts.auth_payload` e `rd_station_settings.oauth_*` armazenam tokens sem criptografia.
- **Impacto:** Breach expõe tokens com acesso a contas de anúncios e CRM externo.
- **Solução:** Encrypt no write (Edge Function), decrypt no read. Chave em Supabase Secret.
- **Esforço:** Médio | **Prioridade:** Média

### 🟢 P8 — Webhook endpoints sem validação de assinatura

- **Problema:** `rd-station-webhook` e `billing` webhooks aceitam payloads sem verificar assinatura HMAC.
- **Impacto:** Atacante pode forjar webhooks para alterar status de pagamento ou injetar leads.
- **Causa:** Complexidade de implementação; webhooks entregues sem docs de validação.
- **Solução:** Asaas fornece header `asaas-access-token`; RD Station envia `X-RD-Signature`.
- **Esforço:** Baixo | **Prioridade:** Média

### 🟢 P9 — Sem soft-delete em entidades críticas

- **Problema:** Leads e contratos são deletados fisicamente (DELETE). Sem possibilidade de recovery.
- **Impacto:** Deleção acidental é irreversível; compliance (LGPD) dificulta auditoria.
- **Solução:** Coluna `deleted_at` + RLS filter `WHERE deleted_at IS NULL`. Já existe `deleted_property_media` como precedente.
- **Esforço:** Médio | **Prioridade:** Baixa

### 🟢 P10 — Logs de erro expõem stack traces ao frontend

- **Problema:** Catch blocks retornam `err.message` diretamente na response, potencialmente expondo paths internos ou detalhes de implementação.
- **Causa:** Pattern `JSON.stringify({ error: err.message })` em ~60 functions.
- **Solução:** Retornar mensagem genérica ao frontend; logar detalhes via `console.error`.
- **Esforço:** Baixo | **Prioridade:** Baixa

---

## Riscos Críticos vs. Silenciosos

### Críticos (impacto imediato se explorados)
1. `send-reset-email` sem rate limit → spam/billing abuse
2. Plan limits não enforced → receita perdida
3. Deleção não-atômica → orphans/inconsistência

### Silenciosos (crescem com o tempo)
1. Functions penduradas sem timeout → custo acumulado
2. OAuth tokens em texto plano → risco latente
3. Webhooks sem validação de assinatura → forjamento possível
4. Sem circuit breaker → falha cascata em integrações
5. Stack traces nas respostas → information disclosure

---

## Melhorias Priorizadas

| # | Melhoria | Prioridade | Esforço | Risco |
|---|---------|-----------|---------|-------|
| 1 | Rate limit em send-reset-email | Alta | Baixo | Nenhum |
| 2 | RPC delete_property_cascade | Alta | Baixo | Baixo |
| 3 | fetchWithTimeout em _shared/ | Alta | Baixo | Nenhum |
| 4 | Enforcement de limites de plano | Alta | Médio | Médio |
| 5 | Audit das 35 functions sem auth manual | Alta | Médio | Baixo |
| 6 | Validação de assinatura em webhooks | Média | Baixo | Baixo |
| 7 | Encrypt OAuth tokens | Média | Médio | Médio |
| 8 | Mensagens genéricas em erros de API | Baixa | Baixo | Nenhum |
| 9 | Soft-delete em leads/contratos | Baixa | Médio | Médio |
| 10 | Circuit breaker para providers | Média | Médio | Baixo |

---

## Plano de Execução em Fases

### Fase 1 — Proteção Imediata (Semana 1-2, ~10h)

#### 1.1 — Rate limit em send-reset-email
- **Objetivo:** Máximo 5 resets por email por 15 minutos
- **Como:** Contar chamadas recentes em `audit_events` ou tabela dedicada antes de `generateLink`
- **Esforço:** Baixo (2h) | **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Endpoint público protegido contra abuse

#### 1.2 — RPC delete_property_cascade
- **Objetivo:** Deleção atômica de imóvel + dependências
- **Como:** Function SQL com BEGIN que deleta images, media, owners, property
- **Esforço:** Baixo (2h) | **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Zero orphans

#### 1.3 — _shared/fetch.ts (fetchWithTimeout)
- **Objetivo:** Timeout de 15s em fetches externos
- **Como:** Wrapper com AbortController; aplicar em ~15 functions
- **Esforço:** Baixo (3h) | **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Functions não ficam penduradas

#### 1.4 — Mensagens genéricas em erros
- **Objetivo:** Não expor stack traces ao frontend
- **Como:** Pattern `{ error: "Erro interno", code: "INTERNAL_ERROR" }`; `console.error` para detalhes
- **Esforço:** Baixo (2h) | **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Information disclosure eliminado

### Fase 2 — Enforcement e Validação (Semana 3-4, ~12h)

#### 2.1 — Enforcement de limites de plano
- **Objetivo:** Banco rejeita INSERT se org excede max_leads/max_properties
- **Como:** Trigger BEFORE INSERT que consulta plan via subscription
- **Esforço:** Médio (4h) | **Risco:** Médio (pode bloquear operações legítimas se mal configurado)
- **Dependências:** Nenhuma
- **Resultado:** Impossível burlar limites via API direta

#### 2.2 — Audit de functions sem auth manual
- **Objetivo:** Verificar que functions que manipulam dados validam identidade
- **Como:** Revisar cada function com `verify_jwt=false`; adicionar `getUser()` onde necessário
- **Esforço:** Médio (4h) | **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Superfície de ataque reduzida

#### 2.3 — Validação de assinatura em webhooks
- **Objetivo:** Asaas e RD Station webhooks validados
- **Como:** Verificar header de assinatura antes de processar payload
- **Esforço:** Baixo (2h) | **Risco:** Baixo
- **Dependências:** Secrets de webhook configurados
- **Resultado:** Forjamento de webhooks impossível

#### 2.4 — Rate limit em billing/platform-signup
- **Objetivo:** Prevenir abuse em endpoints financeiros
- **Como:** Similar ao rate limit de send-reset-email
- **Esforço:** Baixo (2h) | **Risco:** Nenhum
- **Dependências:** 1.1 (pattern estabelecido)
- **Resultado:** Proteção contra abuse financeiro

### Fase 3 — Resiliência e Compliance (Semana 5-8, ~15h)

#### 3.1 — Encrypt OAuth tokens
- **Objetivo:** Tokens Meta/RD Station cifrados em repouso
- **Esforço:** Médio (4h) | **Risco:** Médio
- **Dependências:** Secret ENCRYPTION_KEY

#### 3.2 — Circuit breaker para providers
- **Objetivo:** Não tentar provider que está fora do ar
- **Esforço:** Médio (4h) | **Risco:** Baixo

#### 3.3 — Soft-delete em leads e contratos
- **Objetivo:** Deleções reversíveis; compliance LGPD
- **Esforço:** Médio (4h) | **Risco:** Médio

#### 3.4 — Idempotency keys em webhooks de pagamento
- **Objetivo:** Processar cada evento uma única vez
- **Esforço:** Baixo (3h) | **Risco:** Baixo

---

## Backlog Técnico Executável

```
FASE 1 — PROTEÇÃO IMEDIATA (Semana 1-2, ~10h)
[ ] 1.1 Rate limit send-reset-email (5/15min/email) .... 2h [Segurança] [P0]
[ ] 1.2 RPC delete_property_cascade .................... 2h [Integridade] [P0]
[ ] 1.3 _shared/fetch.ts + aplicar em 15 functions ..... 3h [Resiliência] [P0]
[ ] 1.4 Mensagens genéricas em erros de API ............ 2h [Segurança] [P1]

FASE 2 — ENFORCEMENT E VALIDAÇÃO (Semana 3-4, ~12h)
[ ] 2.1 Trigger enforcement limites de plano ........... 4h [Negócio] [P0]
[ ] 2.2 Audit 35 functions sem auth manual ............. 4h [Segurança] [P1]
[ ] 2.3 Validação assinatura webhooks (Asaas/RD) ....... 2h [Segurança] [P1]
[ ] 2.4 Rate limit em billing/platform-signup .......... 2h [Segurança] [P1]

FASE 3 — RESILIÊNCIA E COMPLIANCE (Semana 5-8, ~15h)
[ ] 3.1 Encrypt OAuth tokens ........................... 4h [Segurança] [P1]
[ ] 3.2 Circuit breaker para providers ................. 4h [Resiliência] [P2]
[ ] 3.3 Soft-delete leads/contratos .................... 4h [Compliance] [P2]
[ ] 3.4 Idempotency keys em webhooks ................... 3h [Integridade] [P2]
```

**Total: ~37h em 8 semanas.**

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
