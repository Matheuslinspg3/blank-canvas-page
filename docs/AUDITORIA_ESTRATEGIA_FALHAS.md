# Auditoria de Estratégia de Falhas — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Mapa de Falhas Prováveis

| # | Falha | Tipo | Módulo Afetado | Prob. | Impacto |
|---|-------|------|---------------|-------|---------|
| F1 | Supabase DB timeout/504 | Infra | App inteira | Alta (já ocorreu) | 🔴 Crítico |
| F2 | Asaas fora do ar ou lento | Serviço externo | Billing | Baixa | 🔴 Crítico |
| F3 | Asaas webhook duplicado ou fora de ordem | Concorrência | Billing | Média | 🟡 Importante |
| F4 | Resend falha ao enviar email | Serviço externo | Auth/Convites | Baixa | 🟡 Importante |
| F5 | R2 upload falha (timeout/rede) | Serviço externo | Imóveis | Baixa | 🟡 Importante |
| F6 | AI Provider indisponível | Serviço externo | IA | Média | 🟢 Tolerável |
| F7 | Meta/RD Station API falha | Serviço externo | Ads/CRM | Média | 🟢 Tolerável |
| F8 | OneSignal falha | Serviço externo | Push | Baixa | 🟢 Tolerável |
| F9 | Deleção de imóvel parcial (orphan) | Lógica negócio | Imóveis | Média | 🟡 Importante |
| F10 | Código de contrato duplicado | Concorrência | Contratos | Baixa (corrigido) | 🟡 Importante |
| F11 | Import Imobzi falha no meio | Infra/Timeout | Import | Média | 🟢 Tolerável |
| F12 | Token de auth expirado durante operação longa | Auth | Geral | Média | 🟡 Importante |
| F13 | Duplo clique cria recurso duplicado | UI/Concorrência | CRM/Contratos | Alta | 🟡 Importante |
| F14 | Limites de plano não enforçados no banco | Lógica negócio | Cadastro | Alta | 🔴 Crítico |
| F15 | Edge Function 150s timeout em operação longa | Infra | Import/IA | Média | 🟡 Importante |
| F16 | Falha silenciosa em activity_log/audit | Lógica negócio | Rastreabilidade | Alta | 🟢 Tolerável |
| F17 | Webhook RD Station sem validação de assinatura | Segurança | CRM | Média | 🟡 Importante |
| F18 | `send-reset-email` sem rate limit | Abuso | Auth | Alta | 🔴 Crítico |

---

## 2. Classificação por Criticidade

### 🔴 Falhas Críticas — resposta imediata necessária
| Falha | Estado Atual | Gap |
|-------|-------------|-----|
| **F1 — DB timeout** | React Query retry 3x, staleTime 2min, AbortController em queries | ✅ Bem coberto. Gap: sem health check proativo |
| **F2 — Asaas indisponível** | `asaasFetch()` wrapper | ❌ Sem timeout, sem retry, sem fallback |
| **F14 — Limites de plano** | Verificação apenas no frontend | ❌ Sem enforcement no banco (BEFORE INSERT trigger) |
| **F18 — Reset email abuse** | Endpoint público sem rate limit | ❌ Pode ser abusado para spam/custo Resend |

### 🟡 Falhas Importantes — retry ou reprocessamento
| Falha | Estado Atual | Gap |
|-------|-------------|-----|
| **F3 — Webhook duplicado** | `provider_event_id` + `payload_hash` | ⚠️ Check de idempotência existe mas não bloqueia 100% (race condition possível) |
| **F4 — Email falha** | Fetch direto, sem retry | ❌ Email perdido sem reprocessamento |
| **F5 — R2 upload falha** | Retry manual pelo usuário | ⚠️ Sem retry automático |
| **F9 — Deleção parcial** | 4 DELETEs separados no frontend | ❌ Sem transação atômica |
| **F12 — Token expirado** | Supabase auto-refresh | ✅ Coberto pelo SDK |
| **F13 — Duplo clique** | Sem proteção global | ❌ Mutations sem `isPending` guard consistente |
| **F15 — 150s timeout** | Chunking em imobzi-process | ✅ Bem resolvido com chain pattern |
| **F17 — RD webhook inseguro** | Sem validação X-RD-Signature | ❌ Aceita qualquer POST |

### 🟢 Falhas Toleráveis — degradação ou monitoramento
| Falha | Estado Atual | Gap |
|-------|-------------|-----|
| **F6 — IA indisponível** | Multi-provider + auto-healing | ✅ Melhor resiliência do projeto |
| **F7 — Meta/RD API falha** | Feature isolada | ⚠️ Sem timeout nos fetches |
| **F8 — OneSignal falha** | Retry com external_id | ✅ Coberto |
| **F11 — Import falha no meio** | Chain + status tracking + retry manual | ✅ Coberto (run_items permite retry) |
| **F16 — Audit silencioso** | `catch {}` silencioso | ⚠️ Correto (não quebrar app), mas sem alerta |

---

## 3. Lacunas de Resiliência

### 3.1 Sem Timeout em Chamadas Externas
**Funções afetadas:** `asaasFetch()`, `send-reset-email`, `send-invite-email`, Meta API fetches
**Risco:** Request pendura até o hard limit de 150s do Edge Function
**Solução:** `fetchWithTimeout()` já existe em `rd-station-sync-leads` — extrair para `_shared/fetch.ts`

### 3.2 Sem Circuit Breaker
**Nenhuma** integração implementa circuit breaker. Se Asaas estiver retornando 500, todas as requests continuam sendo feitas.
**Exceção:** AI Router tem auto-healing com cooldown exponencial — padrão similar a circuit breaker.

### 3.3 Sem Dead Letter Queue (DLQ)
Não existe DLQ para webhooks falhos, emails não enviados ou operações compensatórias.
Webhooks são logados em `billing_webhook_logs` mas sem reprocessamento.

### 3.4 Sem Retry Automático em Operações Críticas
| Operação | Retry? | Idempotente? |
|----------|--------|-------------|
| Criar customer Asaas | ❌ | ❌ |
| Criar subscription Asaas | ❌ | ❌ |
| Enviar email Resend | ❌ | ✅ (sem efeito colateral) |
| Upload R2 | ❌ (manual) | ✅ (PUT idempotente) |
| Processar webhook Asaas | ❌ | ✅ (provider_event_id check) |
| Sync leads Meta | ❌ | ⚠️ (upsert, mas sem controle) |
| Sync leads RD Station | ❌ | ⚠️ |
| Import Imobzi | ✅ (chain retry 3x) | ✅ (run_items tracking) |
| AI Router | ✅ (multi-provider) | ✅ |

### 3.5 Sem Proteção contra Duplo Clique no Frontend
Mutations `useMutation` existem mas nem todas as UIs desabilitam o botão durante `isPending`.
Risco: criar lead/contrato/imóvel duplicado.

### 3.6 Operações Não-Atômicas no Frontend
- Deleção de imóvel: 4 queries separadas (images → favorites → appointments → property)
- Se qualquer uma falhar, orphan records permanecem
- Solução: RPC `delete_property_cascade()` no banco

### 3.7 Sem Persistência de Rascunho
Formulários longos (criar imóvel, criar contrato) não salvam rascunho.
Se o browser travar ou a sessão expirar, dados preenchidos são perdidos.

---

## 4. Melhorias de UX Durante Falha

### Estado Atual
| Situação | UX Atual | Problema |
|---------|---------|---------|
| Erro em mutation | Toast "Erro ao criar X" com `error.message` | ⚠️ Mensagem técnica (ex: "violates foreign key") |
| Erro de rede | Toast genérico | ⚠️ Sem sugestão de próximo passo |
| Upload falha | Console.error, retorna null | ❌ Usuário não sabe que falhou |
| Asaas fora | Erro genérico | ❌ Sem indicação de retry |
| Supabase lento | Loading spinner infinito | ⚠️ AbortController ajuda, mas sem mensagem |

### Melhorias Recomendadas

| # | Melhoria | Esforço | Prioridade |
|---|---------|---------|-----------|
| UX1 | Mapear erros do Supabase para mensagens amigáveis em PT-BR | Baixo | Alta |
| UX2 | Adicionar botão "Tentar novamente" em toasts de erro | Baixo | Alta |
| UX3 | Desabilitar botões durante `isPending` em todas as mutations | Baixo | Alta |
| UX4 | Toast com progresso para uploads (1 de 5 fotos...) | Médio | Média |
| UX5 | Salvar rascunho de formulários longos em localStorage | Médio | Média |
| UX6 | Skeleton loading em vez de spinner nos módulos principais | Médio | Baixa |

---

## 5. Recomendações: Retry, Idempotência, Compensação

### 5.1 Retry

| Operação | Estratégia | Impl. |
|----------|-----------|-------|
| `asaasFetch()` | Retry 2x com backoff 1s/3s para 429/5xx | `_shared/fetch.ts` |
| `send-reset-email` / `send-invite-email` | Retry 1x para 5xx | Inline |
| R2 upload (presigned PUT) | Retry 1x no frontend | `useImageUpload.ts` |
| Meta API fetch | Retry 1x para 5xx | Inline |

### 5.2 Idempotência

| Operação | Chave de Idempotência | Status |
|----------|---------------------|--------|
| Webhook Asaas | `provider_event_id` | ✅ Implementado |
| Criar customer Asaas | `organization_id` (check before create) | ⚠️ Parcial |
| Enviar email | Sem efeito colateral — safe to retry | ✅ |
| Criar lead/contrato | Sem proteção | ❌ Adicionar `isPending` guard |
| Sync Meta/RD | Upsert por `external_id` | ✅ |

### 5.3 Compensação

| Cenário de Falha | Compensação Necessária |
|-----------------|----------------------|
| Deleção parcial de imóvel | RPC `delete_property_cascade()` com transaction | 
| Subscription Asaas criada mas billing_payment não | Reconciliação via webhook |
| Import parcial Imobzi | `run_items` com status tracking + retry manual |
| Email não enviado | Fila + DLQ (futuro) |

---

## 6. Runbooks Mínimos

### RB1 — Supabase Degradado (504/timeout)
```
1. VERIFICAR: Supabase Status (status.supabase.com)
2. VERIFICAR: Dashboard > Database > Connections (pool esgotado?)
3. MITIGAR: maintenance_mode = true em app_runtime_config
4. COMUNICAR: Banner na app via maintenance_message
5. MONITORAR: React Query retry deve cobrir falhas transitórias
6. ESCALAR: Se > 15min, contatar Supabase Support
```

### RB2 — Asaas Indisponível
```
1. VERIFICAR: status.asaas.com
2. IMPACTO: Novos pagamentos e upgrades não funcionam
3. MITIGAR: Nenhuma ação necessária (webhooks serão reenviados pelo Asaas)
4. VERIFICAR: billing_webhook_logs para eventos perdidos após recovery
5. RECONCILIAR: Comparar subscriptions ativas com status no Asaas
```

### RB3 — Resend Indisponível
```
1. VERIFICAR: resend.com/status
2. IMPACTO: Convites e reset de senha não chegam
3. MITIGAR: Nenhuma (sem provider alternativo)
4. COMUNICAR: Toast "tente novamente em alguns minutos"
5. FUTURO: Implementar fila para retry
```

### RB4 — Upload de Imagens Falha (R2)
```
1. VERIFICAR: Cloudflare Status
2. VERIFICAR: Edge Function logs de r2-upload
3. MITIGAR: Usuário pode tentar novamente (PUT é idempotente)
4. VERIFICAR: property_images sem cloudinary_url (orphans)
```

### RB5 — AI Router Sem Providers Disponíveis
```
1. VERIFICAR: ai_router_provider_stats (erros recentes)
2. VERIFICAR: Cooldowns ativos (consecutive_errors >= 10)
3. MITIGAR: Auto-healing reativa providers após cooldown
4. FORÇAR: UPDATE ai_router_providers SET consecutive_errors = 0 WHERE provider_key = '...'
5. MONITORAR: ai_router_logs taxa de sucesso
```

### RB6 — Import Imobzi Parou no Meio
```
1. VERIFICAR: import_runs.status = 'failed' ou 'processing' há > 30min
2. VERIFICAR: import_run_items com status 'pending' ou 'error'
3. MITIGAR: Frontend oferece botão "Reprocessar falhos"
4. MANUAL: Invocar imobzi-process com run_id para continuar
5. VERIFICAR: Properties criadas sem imagens (images_processed = 0)
```

---

## 7. Backlog Priorizado por Risco e Impacto

```
FASE 1 — RISCOS CRÍTICOS (Semana 1-2, ~10h)
[ ] F18  Rate limit em send-reset-email ................. 2h [P0]
[ ] 3.1  _shared/fetch.ts + timeout em asaasFetch ....... 2h [P0]
[ ] F13  isPending guard em todas mutations críticas ..... 2h [P0]
[ ] F14  BEFORE INSERT trigger para limites de plano .... 2h [P0]
[ ] UX1  Mapeamento de erros Supabase → mensagens PT-BR . 2h [P0]

FASE 2 — FALHAS IMPORTANTES (Semana 3-4, ~10h)
[ ] F9   RPC delete_property_cascade() .................. 2h [P1]
[ ] F17  Validar X-RD-Signature no webhook .............. 1h [P1]
[ ] 5.1  Retry com backoff em asaasFetch para 429/5xx ... 1h [P1]
[ ] F4   Retry 1x para emails Resend .................... 1h [P1]
[ ] UX2  Botão "Tentar novamente" em toasts de erro ..... 1h [P1]
[ ] UX3  Timeout em Meta API fetches .................... 1h [P1]
[ ] F3   SELECT FOR UPDATE no webhook Asaas (race cond.) . 1h [P1]
[ ] 6.0  Runbooks documentados no repo .................. 2h [P1]

FASE 3 — RESILIÊNCIA AVANÇADA (Semana 5-8, ~12h)
[ ] 3.3  DLQ para webhooks falhos (tabela + reprocesso) . 3h [P2]
[ ] UX5  Rascunho em localStorage para forms longos ..... 3h [P2]
[ ] 3.2  Circuit breaker simples para Asaas ............. 2h [P2]
[ ] UX4  Toast de progresso para uploads ................ 2h [P2]
[ ] F16  Alerta (Sentry) quando audit_log falha ......... 1h [P2]
[ ] 4.0  Health check endpoint + widget admin ........... 1h [P2]
```

**Total: ~32h em 8 semanas.**

---

## 8. Padrões Existentes a Replicar

### ✅ AI Router — Melhor Resiliência
- Multi-provider failover
- Auto-healing com cooldown exponencial
- Rate limiting (20 req/h por usuário)
- Logging estruturado
- Score-based routing

### ✅ Imobzi Import — Melhor Chain Pattern
- Chunking (3 properties por invocação)
- Timeout guard (120s, para antes do 150s limit)
- Chain retry (3 tentativas)
- Status tracking granular (run_items)
- Retry manual pelo frontend

### ✅ Billing Webhook — Melhor Idempotência
- `provider_event_id` deduplication
- `payload_hash` para detecção de duplicata
- Sanitização de payload (sem PII)
- Logging estruturado

**Recomendação:** Extrair esses padrões para `_shared/` e adotar em todas as integrações.

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
