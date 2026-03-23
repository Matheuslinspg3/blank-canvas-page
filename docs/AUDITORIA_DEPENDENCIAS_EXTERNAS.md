# Auditoria de Dependências Externas — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Mapa de Dependências Externas

| # | Provedor | Tipo | Functions | Papel | Criticidade |
|---|---------|------|-----------|-------|-------------|
| D1 | **Supabase** (Auth + DB + Storage + Edge) | Plataforma core | Toda a app | Central ao negócio | 🔴 Se falhar, app para |
| D2 | **Asaas** | Gateway de pagamento | `billing`, `billing-webhook` | Crítico ao produto | 🔴 Se falhar, ninguém paga |
| D3 | **Resend** | Email transacional | `send-reset-email`, `send-invite-email` | Crítico ao produto | 🟡 Sem reset de senha; sem convites |
| D4 | **Cloudflare R2** | Storage de imagens | `r2-presign`, `migrate-to-r2`, `cleanup-orphan-media` | Crítico ao produto | 🟡 Sem upload de fotos |
| D5 | **Cloudinary** | Storage de imagens (legado + IA) | `ai-router`, `generate-property-art`, `cleanup-orphan-media` | Complementar | 🟢 Fallback existe (data URL) |
| D6 | **OneSignal** | Push notifications | `send-push`, `notifications-register-device`, `notifications-test` | Complementar | 🟢 Pode degradar sem quebrar |
| D7 | **Meta Ads API** | Integração de anúncios | `meta-sync-leads`, `meta-sync-entities`, `meta-save-account`, `meta-oauth-callback` | Complementar | 🟢 Feature isolada |
| D8 | **RD Station** | CRM externo | `rd-station-webhook`, `rd-station-sync-leads`, `rd-station-oauth-callback`, `rd-station-send-event`, `rd-station-stats` | Complementar | 🟢 Feature isolada |
| D9 | **OpenAI / Gemini / Groq** | IA generativa | `ai-router` (centralizado) | Complementar | 🟢 Multi-provider com failover |
| D10 | **Imobzi** | ERP imobiliário | `imobzi-import`, `imobzi-process` | Temporário/import | 🟢 Pode ser adiado |
| D11 | **N8N** | Automação (tickets, CRECI) | Webhooks: `N8N_TICKET_WEBHOOK_URL`, `N8N_CRECI_WEBHOOK_URL` | Operacional | 🟢 Pode enfileirar |
| D12 | **Leaflet/OpenStreetMap** | Mapas (frontend) | Componentes React | Complementar | 🟢 Degradação invisível |

---

## 2. Classificação por Criticidade

### 🔴 Se falhar, o produto para
| Provedor | Impacto | Mitigação Atual | Gap |
|---------|---------|----------------|-----|
| Supabase | Auth, DB, Edge Functions — tudo para | React Query retry + staleTime | Sem fallback real; single point of failure |
| Asaas | Ninguém assina, paga ou renova | Nenhuma | Sem fallback; sem cache de status de pagamento |

### 🟡 Se falhar, feature crítica para
| Provedor | Impacto | Mitigação Atual | Gap |
|---------|---------|----------------|-----|
| Resend | Sem reset de senha, sem convites | Nenhuma | Sem retry; sem fila; sem provider alternativo |
| Cloudflare R2 | Sem upload de fotos novas | Nenhuma | Fotos existentes em cache do browser |

### 🟢 Se falhar, pode degradar sem quebrar
| Provedor | Impacto | Mitigação Atual |
|---------|---------|----------------|
| Cloudinary | Conversão de imagem para IA falha | Fallback data URL no `generate-property-art` |
| OneSignal | Push não chega | Retry com external_id alias |
| Meta Ads | Sync de leads de anúncios para | Feature isolada |
| RD Station | Sync bidirecional para | Feature isolada |
| AI Providers | IA generativa indisponível | Multi-provider chain com auto-healing no `ai-router` |
| Imobzi | Import batch para | Pode ser reagendado |

---

## 3. Análise Detalhada por Dependência

### D1 — Supabase (Plataforma Core)

**Contrato:** SDK JS (`@supabase/supabase-js`), REST API, Realtime, Edge Functions Runtime (Deno)
**Lock-in:** Alto — Auth, RLS, Edge Functions, Storage, pg_cron, pgmq são específicos Supabase
**Custos:** Plano Pro R$140/mês; egress, invocações e storage crescem com uso
**Timeout:** SDK não aplica timeout; Edge Functions têm 150s hard limit
**Resiliência:** React Query com 3 retries + staleTime 2min; `networkMode: offlineFirst`
**Risco:** Plano Nano já atingiu limites (504, "Insalubre"); migrado para Pro

**Gaps:**
- Sem health check do Supabase no app (maintenance mode é fail-open, mas não detecta degradação parcial)
- 58 Edge Functions com `verify_jwt=false` — superfície de ataque ampla

### D2 — Asaas (Pagamentos)

**Contrato:** REST API v3 (`api.asaas.com/v3`), webhooks com `asaas-access-token` header
**Lock-in:** Médio — `asaasFetch()` wrapper já abstrai parcialmente; mas IDs de customer/subscription são do Asaas
**Custos:** Por transação (taxa do gateway)
**Timeout:** ❌ `asaasFetch()` não tem timeout — pode pendurar 150s
**Resiliência:** ❌ Sem retry; erro no Asaas = erro pro usuário
**Webhook:** ✅ Valida `asaas-access-token` header; ✅ Loga em `billing_webhook_logs`
**Idempotência:** ⚠️ `payload_hash` existe mas não verifica duplicata antes de processar

**Gaps:**
- `asaasFetch()` sem timeout
- Sem retry na criação de customer/payment
- Sem circuit breaker (se Asaas estiver lento, todas as requests empilham)
- Webhook não verifica idempotência via `payload_hash`

### D3 — Resend (Email)

**Contrato:** REST API (`api.resend.com/emails`), API key no header
**Lock-in:** Baixo — `fetch()` direto à API; substituível por qualquer provider SMTP/API
**Custos:** Por email enviado
**Timeout:** ❌ Sem timeout no fetch
**Resiliência:** ❌ Sem retry; sem fila; email perdido se falhar

**Gaps:**
- `send-reset-email` e `send-invite-email` fazem fetch direto sem timeout
- Sem rate limiting no `send-reset-email` (endpoint público)
- Erro do Resend retorna detalhes ao frontend (information disclosure)

### D4 — Cloudflare R2 (Storage)

**Contrato:** S3-compatible API via `aws4fetch`; presigned URLs via Edge Function
**Lock-in:** Baixo — compatível com S3; pode migrar para qualquer provider S3
**Custos:** Por storage + egress
**Timeout:** ❌ Sem timeout nos uploads

**Gaps:**
- Upload via presigned URL depende da Edge Function `r2-presign` estar disponível
- Sem retry no upload do frontend

### D5 — Cloudinary (Storage legado + IA)

**Contrato:** REST API (`api.cloudinary.com/v1_1/`); HMAC signature para uploads
**Lock-in:** Médio — `cloudinary_public_id` armazenado; `res.cloudinary.com` URLs hardcoded
**Custos:** Por transformação + storage
**Resiliência:** ✅ Redundância com conta secundária (`CLOUDINARY2_*`); fallback data URL

**Status:** Migrado para R2 para imagens normais; mantido para conversão PNG na IA.

### D6 — OneSignal (Push)

**Contrato:** REST API (`api.onesignal.com/notifications`), App ID + REST API Key
**Lock-in:** Médio — `user_devices` tabela com `onesignal_id`; service abstrai via `notification-service.ts`
**Resiliência:** ✅ Retry com `external_id` alias se device IDs falham; ✅ Serviço dedicado (`_shared/notification-service.ts`)

**Melhor integração do projeto** — já tem abstração, retry e logging.

### D7 — Meta Ads API

**Contrato:** Graph API v18; OAuth 2.0 com refresh token
**Lock-in:** Médio — IDs de campanha/adset são do Meta
**Custos:** Gratuito (API de leitura)
**Resiliência:** ❌ Sem timeout; sem retry

**Gaps:**
- OAuth tokens em texto plano no banco (`ad_accounts.auth_payload`)
- Sem refresh automático de token (manual via re-OAuth)
- Sem timeout nos fetches

### D8 — RD Station

**Contrato:** REST API (`api.rd.services`); OAuth 2.0 com refresh token; webhooks
**Lock-in:** Médio — `rd_station_settings` com OAuth tokens
**Resiliência:** ✅ Token refresh automático implementado

**Gaps:**
- OAuth tokens em texto plano
- Webhook sem validação de assinatura (`X-RD-Signature` não verificado)
- Sem timeout nos fetches à API

### D9 — AI Providers (OpenAI/Gemini/Groq)

**Contrato:** OpenAI-compatible API; chaves via `ai_router_providers` tabela
**Lock-in:** Baixo — `ai-router` abstrai completamente; multi-provider
**Resiliência:** ✅ Auto-healing com cooldown exponencial; ✅ Rate limiting (20 req/h); ✅ Multi-provider failover; ✅ Gemini key rotation

**Melhor resiliência do projeto.** Padrão a ser replicado.

---

## 4. Riscos Consolidados

### Indisponibilidade
| Risco | Provedor | Probabilidade | Impacto |
|-------|---------|--------------|---------|
| Asaas fora do ar | Asaas | Baixa | 🔴 Ninguém paga |
| Resend fora do ar | Resend | Baixa | 🟡 Sem reset de senha |
| R2 fora do ar | Cloudflare | Muito baixa | 🟡 Sem upload |
| Supabase degradado | Supabase | Média (já ocorreu) | 🔴 App inteira degrada |

### Lock-in
| Risco | Provedor | Nível | Mitigação |
|-------|---------|------|-----------|
| Auth + DB + Edge | Supabase | Alto | Sem alternativa viável curto prazo |
| IDs de pagamento | Asaas | Médio | Abstração via `asaasFetch` |
| Push device IDs | OneSignal | Médio | `notification-service.ts` abstrai |
| Imagens legado | Cloudinary | Médio | Migração para R2 em andamento |

### Quebra de Contrato
| Risco | Provedor | Probabilidade |
|-------|---------|--------------|
| Meta depreciação de Graph API | Meta | Alta (versionamento frequente) |
| Asaas mudança de API | Asaas | Baixa |
| RD Station mudança de API | RD Station | Média |

---

## 5. Proposta de Abstração Mínima por Integração

### Já Abstraídas (✅ bom estado)
- **AI Providers:** `ai-router` centraliza routing, failover e logging
- **OneSignal:** `_shared/notification-service.ts` encapsula API
- **Asaas:** `asaasFetch()` wrapper (parcial — falta timeout/retry)

### Precisam de Abstração
| Integração | Abstração Proposta | Esforço |
|-----------|-------------------|---------|
| Resend | `_shared/email.ts` — `sendEmail(to, subject, html)` com timeout + retry | Baixo |
| Asaas | Adicionar timeout + retry ao `asaasFetch()` existente | Baixo |
| R2 | `_shared/storage.ts` — `uploadToR2(key, body)` com timeout | Baixo |
| Meta Ads | `_shared/meta.ts` — `metaFetch(path, token)` com timeout | Baixo |
| RD Station | `_shared/rdstation.ts` — `rdFetch(path, token)` com timeout + token refresh | Médio |

### Padrão Recomendado: `fetchWithTimeout`
```typescript
// _shared/fetch.ts
export async function fetchWithTimeout(
  url: string, init: RequestInit = {}, timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```
Este wrapper já existe em `imobzi-import`. Precisa ser extraído para `_shared/` e adotado por todas as functions.

---

## 6. Melhorias de Resiliência e Segurança

| # | Melhoria | Provedor | Esforço | Prioridade |
|---|---------|---------|---------|-----------|
| R1 | Timeout em `asaasFetch()` | Asaas | Baixo | Alta |
| R2 | Timeout em `send-reset-email` e `send-invite-email` | Resend | Baixo | Alta |
| R3 | Rate limit em `send-reset-email` | Resend | Baixo | Alta |
| R4 | Verificar `payload_hash` antes de processar webhook Asaas | Asaas | Baixo | Alta |
| R5 | Validar `X-RD-Signature` no webhook RD Station | RD Station | Baixo | Média |
| R6 | Timeout em Meta API fetches | Meta | Baixo | Média |
| R7 | Encrypt OAuth tokens (Meta + RD Station) | Meta/RD | Médio | Média |
| R8 | `_shared/fetch.ts` extraído do imobzi-import | Todos | Baixo | Alta |
| R9 | `_shared/email.ts` wrapper para Resend | Resend | Baixo | Média |
| R10 | Retry com backoff em `asaasFetch()` para 429/5xx | Asaas | Baixo | Média |

---

## 7. Backlog Técnico Priorizado

```
FASE 1 — RESILIÊNCIA BÁSICA (Semana 1, ~6h)
[ ] R8  _shared/fetch.ts (fetchWithTimeout) .............. 1h [P0]
[ ] R1  Timeout em asaasFetch() .......................... 0.5h [P0]
[ ] R2  Timeout em send-reset-email e send-invite-email .. 1h [P0]
[ ] R3  Rate limit em send-reset-email ................... 2h [P0]
[ ] R4  Idempotência de webhook Asaas (payload_hash) ..... 1h [P0]

FASE 2 — SEGURANÇA DE INTEGRAÇÃO (Semana 2-3, ~6h)
[ ] R5  Validar X-RD-Signature no webhook ................ 1h [P1]
[ ] R6  Timeout em Meta API fetches ...................... 1h [P1]
[ ] R9  _shared/email.ts wrapper Resend .................. 1h [P1]
[ ] R10 Retry com backoff em asaasFetch .................. 1h [P1]
[ ] R7  Encrypt OAuth tokens (Meta + RD Station) ......... 4h [P1]

FASE 3 — ABSTRAÇÃO E OBSERVABILIDADE (Semana 4-5, ~6h)
[ ] Logging estruturado por provider (latência, erros) ... 2h [P2]
[ ] Dashboard de health por integração ................... 2h [P2]
[ ] Retry fila para emails (enqueue + process) ........... 2h [P2]
```

**Total: ~18h em 5 semanas.**

---

## 8. Plano de Mitigação por Dependência

| Provedor | Se cair | Ação Imediata | Ação Preventiva |
|---------|---------|--------------|----------------|
| **Supabase** | App inteira degrada | Maintenance mode (fail-open) | React Query cache; staleTime |
| **Asaas** | Pagamentos param | Toast "tente novamente"; retry | Timeout + retry + idempotência |
| **Resend** | Sem emails | Usuário não sabe; silêncio | Fila + retry; fallback provider |
| **R2** | Sem upload | Toast "upload indisponível" | Timeout + retry no frontend |
| **Cloudinary** | Conversão IA falha | Fallback data URL (já existe) | Manter redundância conta 2 |
| **OneSignal** | Push não chega | Silêncio; notificação in-app | Retry com external_id (já existe) |
| **Meta Ads** | Sync para | Feature oculta | Timeout; flag de status |
| **RD Station** | Sync para | Feature oculta | Timeout; webhook validation |
| **AI Providers** | IA indisponível | Toast "tente mais tarde" | Multi-provider chain (já existe) |

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
