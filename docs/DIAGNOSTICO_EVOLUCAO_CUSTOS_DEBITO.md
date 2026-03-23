# Diagnóstico Consolidado — Evolução, Custo, Débito Técnico e Responsabilidades
**Data:** 2026-03-23 | **Escopo:** Análise de 75+ Edge Functions, 77 hooks, 38 páginas, 50+ tabelas

---

## 1. Top 10 Problemas Mais Graves

### P1 — `useLeads` carrega TODOS os leads sem paginação
- **Impacto:** Com 10 orgs × 1.000 leads = 5MB/sessão. Egress Supabase cresce linearmente. UI trava em mobile.
- **Causa:** Kanban espera array completo para montar colunas por estágio.
- **Solução:** Paginar por estágio (lazy load no drag, carregar 50/estágio).
- **Frontend:** Refatorar `useLeads` + componentes Kanban.
- **Backend:** Criar RPC `get_leads_by_stage(stage_id, limit, offset)`.
- **Banco:** Índice composto `(organization_id, lead_stage_id, position)` se não existir.
- **Arquitetura:** Quebra a premissa de "todos os leads em memória".
- **Esforço:** Alto | **Prioridade:** Alta

### P2 — Deleção de imóvel não-atômica (4 queries separadas)
- **Impacto:** Falha parcial deixa orphans (imagens sem imóvel, owner links quebrados).
- **Causa:** `deleteProperty` em `useProperties.ts` faz DELETE sequencial em 4 tabelas sem transação.
- **Solução:** RPC `delete_property_cascade(property_id)` com `BEGIN/COMMIT`.
- **Frontend:** Substituir 4 chamadas por 1 RPC.
- **Backend:** Nova function SQL.
- **Banco:** Nenhuma mudança de schema.
- **Arquitetura:** Padrão para todas as deleções com dependências.
- **Esforço:** Baixo | **Prioridade:** Alta

### P3 — 75 Edge Functions sem shared auth/CORS/response
- **Impacto:** ~900 linhas de código duplicado. Manutenção cara. Inconsistência de erros (6 formatos).
- **Causa:** Cada function reimplementa validação JWT, headers CORS e formato de resposta.
- **Solução:** `_shared/auth.ts`, `_shared/cors.ts`, `_shared/response.ts`.
- **Frontend:** Nenhum (transparente).
- **Backend:** Refatorar gradualmente (1 function por vez, sem breaking change).
- **Banco:** Nenhum.
- **Arquitetura:** Estabelece contrato de API consistente.
- **Esforço:** Médio | **Prioridade:** Alta

### P4 — `useProperties.ts` com 930 linhas (God Hook)
- **Impacto:** Qualquer mudança em propriedades arrisca quebrar CRUD, imagens, owners, galeria, PDF.
- **Causa:** Hook acumula create, update, delete, reorder images, owners, import — tudo num arquivo.
- **Solução:** Extrair em hooks focados: `usePropertyCRUD`, `usePropertyImages`, `usePropertyOwners`.
- **Frontend:** Refatorar imports nos ~15 componentes que usam.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Reduz blast radius de mudanças.
- **Esforço:** Médio | **Prioridade:** Média

### P5 — Sem timeout em fetches externos (Asaas, Meta, RD Station, Cloudinary)
- **Impacto:** Edge Function fica pendurada até o timeout de 150s do Supabase. Consome invocação mesmo sem resultado.
- **Causa:** `fetch()` nativo sem `AbortController`.
- **Solução:** `_shared/fetch.ts` com `fetchWithTimeout(url, opts, timeoutMs=15000)`.
- **Frontend:** Nenhum.
- **Backend:** Wrapper em ~20 functions que fazem fetch externo.
- **Banco:** Nenhum.
- **Arquitetura:** Resiliência básica.
- **Esforço:** Baixo | **Prioridade:** Alta

### P6 — Geração de código de contrato com race condition
- **Impacto:** Dois contratos criados simultaneamente podem receber o mesmo código.
- **Causa:** `generateCode()` faz SELECT MAX + increment no frontend, sem lock.
- **Solução:** RPC `generate_contract_code()` com `FOR UPDATE` ou sequence.
- **Frontend:** Substituir lógica client-side por chamada RPC.
- **Backend:** Nova function SQL.
- **Banco:** Opcional: sequence `contract_code_seq`.
- **Arquitetura:** Move lógica de negócio crítica para o banco.
- **Esforço:** Baixo | **Prioridade:** Alta

### P7 — CORS `Access-Control-Allow-Origin: *` em 70+ functions
- **Impacto:** Qualquer domínio pode invocar as Edge Functions (mitigado pelo JWT, mas abre vetor de phishing).
- **Causa:** Copy-paste do template inicial.
- **Solução:** `_shared/cors.ts` com allowlist: `[APP_URL, 'https://portocaicaraimoveis.lovable.app']`.
- **Frontend:** Nenhum.
- **Backend:** Substituir `corsHeaders` por `getCorsHeaders(req)`.
- **Banco:** Nenhum.
- **Arquitetura:** Defense in depth.
- **Esforço:** Baixo | **Prioridade:** Média

### P8 — 434 chamadas `supabase.functions.invoke` sem tipo
- **Impacto:** Sem autocomplete, sem validação de payload, erros descobertos só em runtime.
- **Causa:** SDK do Supabase retorna `any` para `functions.invoke`.
- **Solução:** Wrapper tipado `invokeFunction<TInput, TOutput>(name, body)` em `src/lib/api.ts`.
- **Frontend:** Adotar gradualmente (não é breaking change).
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Type safety end-to-end.
- **Esforço:** Médio | **Prioridade:** Média

### P9 — Sem observabilidade de erros de Edge Function no frontend
- **Impacto:** Usuário vê "Erro inesperado" sem contexto. Dev precisa ir aos logs do Supabase.
- **Causa:** Catch genérico com `console.error` + toast genérico.
- **Solução:** Sentry já instalado (`@sentry/react`). Adicionar `Sentry.captureException` nos catch blocks das mutations críticas.
- **Frontend:** ~15 hooks com mutations.
- **Backend:** Garantir que erros retornem `{ error: { code, message } }`.
- **Banco:** Nenhum.
- **Arquitetura:** Ciclo de feedback de erros.
- **Esforço:** Baixo | **Prioridade:** Média

### P10 — OAuth tokens (Meta, RD Station) em texto plano no banco
- **Impacto:** Comprometimento do banco expõe tokens de integração com acesso a contas de anúncios.
- **Causa:** `ad_accounts.auth_payload` e `rd_station_settings.oauth_*` sem criptografia.
- **Solução:** Supabase Vault (quando disponível) ou criptografia AES no Edge Function antes do INSERT.
- **Frontend:** Nenhum (tokens nunca chegam ao frontend).
- **Backend:** Encrypt/decrypt no Edge Function.
- **Banco:** Manter colunas, mudar conteúdo para ciphertext.
- **Arquitetura:** Segurança de dados sensíveis em repouso.
- **Esforço:** Médio | **Prioridade:** Média

---

## 2. Top 10 Melhorias com Maior Impacto

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| M1 | Paginar `useLeads` por estágio | Elimina gargalo de escala do CRM | Alto |
| M2 | `_shared/` (auth, cors, response, fetch) | Reduz 900 linhas duplicadas, padroniza contratos | Médio |
| M3 | RPCs atômicos (delete_property, generate_code, financial_summary) | Elimina race conditions e orphans | Baixo |
| M4 | Wrapper tipado `invokeFunction<T>` | Type safety em 434 call sites | Médio |
| M5 | Quebrar `useProperties` (930 linhas) e `useLeads` (551 linhas) | Manutenibilidade | Médio |
| M6 | Onboarding wizard com checklist persistente | Reduz churn de trial (produto) | Médio |
| M7 | Sentry nos catch blocks de mutations | Observabilidade real de erros | Baixo |
| M8 | `fetchWithTimeout` em fetches externos | Elimina functions penduradas | Baixo |
| M9 | Cleanup automático de logs (pg_cron) | Controla storage do Supabase Pro | Baixo |
| M10 | Rate limiting em `send-reset-email` e `billing` | Previne abuse | Baixo |

---

## 3. Quick Wins (< 2h cada)

| QW | Mudança | Arquivo(s) | Impacto |
|----|---------|-----------|---------|
| QW1 | `fetchWithTimeout` wrapper | `_shared/fetch.ts` + 20 functions | Resiliência |
| QW2 | RPC `generate_contract_code()` | Migration + `useContracts.ts` | Fix race condition |
| QW3 | `Sentry.captureException` em mutations | 15 hooks | Observabilidade |
| QW4 | `staleTime` em hooks sem cache | 5 hooks restantes | Reduz refetch |
| QW5 | `.limit()` em queries sem paginação | `useAiRouterStats`, `useAuditLog` | Protege contra leitura ilimitada |
| QW6 | `Cache-Control` em Edge Functions de leitura pública | `og-metadata`, `portal-xml-feed` | Reduz invocações |

---

## 4. Mudanças Estruturais

| # | Mudança | Dependência | Risco |
|---|---------|-------------|-------|
| E1 | `_shared/` infrastructure (auth, cors, response) | Nenhuma | Baixo (aditivo) |
| E2 | Paginar leads por estágio | Refatorar Kanban | Médio (UX pode mudar) |
| E3 | Extrair hooks monolíticos | Atualizar imports em ~30 arquivos | Baixo |
| E4 | Wrapper tipado para Edge Functions | Nenhuma | Baixo (aditivo) |
| E5 | Event bus para notificações cross-module | Avaliar necessidade real | Alto (overengineering?) |

---

## 5. Mudanças de UX

| # | Mudança | Problema Resolvido |
|---|---------|-------------------|
| U1 | Loading skeleton no Kanban (lazy load por estágio) | Tela branca ao carregar 1000+ leads |
| U2 | Retry automático com exponential backoff em mutations | Usuário perde dados ao falhar |
| U3 | Empty states informativos em todas as listagens | Confusão sobre "não tem dados" vs "erro" |
| U4 | Confirmação de saída com dados não salvos | Perda acidental de formulários longos |
| U5 | Indicador de sync/salvamento automático | Incerteza sobre se dados foram salvos |

---

## 6. Mudanças de Backend (Edge Functions)

| # | Mudança | Functions Afetadas |
|---|---------|-------------------|
| B1 | `_shared/auth.ts` — `requireAuth(req)` | 60+ functions |
| B2 | `_shared/cors.ts` — allowlist dinâmica | 70+ functions |
| B3 | `_shared/response.ts` — envelope padronizado | 70+ functions |
| B4 | `_shared/fetch.ts` — timeout + retry | 20+ functions com fetch externo |
| B5 | Input validation com Zod em `billing`, `ai-router`, `platform-signup` | 3 functions críticas |
| B6 | Rate limiting em `send-reset-email` (5/15min/email) | 1 function |

---

## 7. Mudanças de Banco de Dados

| # | Mudança | Tipo |
|---|---------|------|
| D1 | RPC `delete_property_cascade(property_id)` | Function SQL |
| D2 | RPC `generate_contract_code(org_id)` com sequence | Function SQL + sequence |
| D3 | RPC `compute_financial_summary(org_id, period)` | Function SQL (substitui N queries) |
| D4 | Índice `(organization_id, lead_stage_id, position)` em leads | Index |
| D5 | Cleanup automático de logs com `pg_cron` | Já criado, verificar ativação |
| D6 | Triggers de audit para `contracts` e `commissions` se ausentes | Trigger |

---

## 8. Mudanças de API (Contratos)

| # | Mudança | Impacto |
|---|---------|---------|
| A1 | Envelope padronizado `{ ok, data?, error? }` | Todos os consumers |
| A2 | HTTP status codes corretos (201 para criação, 204 para delete) | Semântica |
| A3 | Versionamento por header `X-API-Version` (futuro) | Nenhum imediato |
| A4 | Separar `billing?action=X` em functions dedicadas | Clareza de roteamento |
| A5 | Documentar contratos das 10 functions mais usadas | Manutenção |

---

## 9. Mudanças de Segurança e Permissão

| # | Mudança | Risco Atual |
|---|---------|-------------|
| S1 | CORS allowlist (substituir `*`) | Phishing via API |
| S2 | Rate limiting em functions públicas | Abuse/DDoS |
| S3 | Criptografar OAuth tokens no banco | Exposição em caso de breach |
| S4 | Revisar 35 functions com `verify_jwt: false` | Acesso não autenticado |
| S5 | Audit trail para eventos de auth (login/logout/reset) | Compliance |
| S6 | Validar que `assistente` não pode DELETE em properties | Escalação de privilégio |

---

## 10. Ordem Recomendada de Implementação

```
Sprint 1 (Semana 1-2): Foundation
├── E1: _shared/ infrastructure
├── QW1: fetchWithTimeout
├── QW2: RPC generate_contract_code
├── QW3: Sentry nos mutations
├── D1: RPC delete_property_cascade
└── QW5: .limit() em queries sem cap

Sprint 2 (Semana 3-4): Robustness
├── B5: Zod validation (billing, ai-router)
├── S1: CORS allowlist
├── M5: Quebrar useProperties e useLeads (refactor)
├── S6: Fix permissão assistente
└── D6: Triggers de audit

Sprint 3 (Semana 5-8): Scale
├── M1: Paginar useLeads por estágio
├── E4: Wrapper tipado invokeFunction<T>
├── S3: Criptografar OAuth tokens
├── D3: RPC compute_financial_summary
└── U1-U5: UX improvements
```

---

## FASE 1 — Correções Críticas (Semana 1-2)

### 1.1 — `_shared/auth.ts` + `_shared/cors.ts` + `_shared/response.ts`
- **Objetivo:** Centralizar 900 linhas duplicadas em 3 módulos reutilizáveis
- **Problema resolvido:** Inconsistência de erros, CORS aberto, auth duplicado
- **Esforço:** Médio (criar os módulos + migrar 5 functions piloto)
- **Risco:** Baixo (aditivo, não quebra functions existentes)
- **Dependências:** Nenhuma
- **Resultado:** Base para migração gradual das 70+ functions

### 1.2 — `fetchWithTimeout` wrapper
- **Objetivo:** Prevenir Edge Functions penduradas em integrações externas
- **Problema resolvido:** Functions que ficam 150s sem resposta (Asaas, Meta, Cloudinary)
- **Esforço:** Baixo (1 arquivo + find-replace em ~20 functions)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Timeout de 15s em qualquer fetch externo

### 1.3 — RPC `delete_property_cascade`
- **Objetivo:** Deleção atômica de imóvel (property + images + media + owners)
- **Problema resolvido:** Orphans no banco quando deleção falha parcialmente
- **Esforço:** Baixo (1 migration + 1 mudança em useProperties)
- **Risco:** Baixo (RPC substitui 4 DELETEs, mesma lógica)
- **Dependências:** Nenhuma
- **Resultado:** Zero orphans em deleções

### 1.4 — RPC `generate_contract_code`
- **Objetivo:** Gerar código de contrato sem race condition
- **Problema resolvido:** Dois usuários simultâneos geram mesmo código
- **Esforço:** Baixo (1 migration + 1 mudança em useContracts)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Códigos únicos garantidos

### 1.5 — Sentry nos catch blocks
- **Objetivo:** Capturar erros reais de produção no Sentry
- **Problema resolvido:** Erros silenciosos que só aparecem nos logs do Supabase
- **Esforço:** Baixo (adicionar `Sentry.captureException` em ~15 hooks)
- **Risco:** Nenhum
- **Dependências:** `@sentry/react` já instalado
- **Resultado:** Dashboard de erros acionável

### 1.6 — `.limit()` em queries sem cap
- **Objetivo:** Proteger contra leitura ilimitada em tabelas de crescimento linear
- **Problema resolvido:** Queries que retornam milhares de registros sem necessidade
- **Esforço:** Baixo (5 hooks)
- **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Egress controlado

---

## FASE 2 — Robustez e Consistência (Semana 3-4)

### 2.1 — Input validation com Zod em functions críticas
- **Objetivo:** Rejeitar payloads inválidos antes de processar
- **Problema resolvido:** Erros obscuros em billing/ai-router por dados malformados
- **Esforço:** Médio (Zod schemas para billing, ai-router, platform-signup)
- **Risco:** Baixo (validação adicional, não remove nada)
- **Dependências:** 1.1 (response padronizado)
- **Resultado:** Erros claros e previsíveis

### 2.2 — CORS allowlist
- **Objetivo:** Restringir origens que podem chamar Edge Functions
- **Problema resolvido:** Qualquer domínio pode invocar APIs (vetor de phishing)
- **Esforço:** Baixo (1 módulo shared + env var `APP_ALLOWED_ORIGINS`)
- **Risco:** Médio (se esquecer um domínio, bloqueia acesso legítimo)
- **Dependências:** 1.1
- **Resultado:** Defense in depth

### 2.3 — Extrair hooks monolíticos
- **Objetivo:** Quebrar `useProperties` (930 linhas) e `useLeads` (551 linhas)
- **Problema resolvido:** Blast radius alto em qualquer mudança de propriedades/leads
- **Esforço:** Médio (refatorar + atualizar ~30 imports)
- **Risco:** Baixo (refactor puro, sem mudança de comportamento)
- **Dependências:** Nenhuma
- **Resultado:** Hooks com responsabilidade única (~200 linhas cada)

### 2.4 — Fix permissão `assistente` em DELETE
- **Objetivo:** Garantir que role `assistente` é realmente read-only
- **Problema resolvido:** Assistente pode deletar properties/appointments via RLS
- **Esforço:** Baixo (ajustar RLS policies)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** RBAC correto

### 2.5 — Triggers de audit para contracts e commissions
- **Objetivo:** Rastrear mudanças em contratos e comissões
- **Problema resolvido:** Alterações financeiras sem audit trail
- **Esforço:** Baixo (triggers similares aos de leads/properties)
- **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Compliance e rastreabilidade

---

## FASE 3 — Escalabilidade e Refinamento (Semana 5-8)

### 3.1 — Paginar `useLeads` por estágio
- **Objetivo:** Carregar leads sob demanda no Kanban
- **Problema resolvido:** 5MB/sessão com 10 orgs × 1000 leads
- **Esforço:** Alto (refatorar Kanban, RPC por estágio, infinite scroll)
- **Risco:** Médio (UX do drag-and-drop pode precisar de ajuste)
- **Dependências:** D4 (índice composto)
- **Resultado:** Kanban escalável para 10.000+ leads

### 3.2 — Wrapper tipado `invokeFunction<TInput, TOutput>`
- **Objetivo:** Type safety end-to-end para Edge Functions
- **Problema resolvido:** 434 chamadas sem tipo (`any` em tudo)
- **Esforço:** Médio (criar types + wrapper + migrar gradualmente)
- **Risco:** Nenhum (aditivo)
- **Dependências:** Nenhuma
- **Resultado:** Autocomplete e validação em compile time

### 3.3 — Criptografar OAuth tokens
- **Objetivo:** Proteger tokens Meta/RD Station em repouso
- **Problema resolvido:** Breach do banco expõe tokens de anúncios
- **Esforço:** Médio (encrypt no write, decrypt no read em Edge Functions)
- **Risco:** Médio (se perder a chave, perde acesso aos tokens)
- **Dependências:** Secret `ENCRYPTION_KEY` no Supabase
- **Resultado:** Dados sensíveis cifrados

### 3.4 — RPC `compute_financial_summary`
- **Objetivo:** Resumo financeiro em 1 query ao invés de 4
- **Problema resolvido:** Dashboard financeiro faz 4 queries separadas
- **Esforço:** Baixo (function SQL + 1 hook)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Dashboard 4x mais rápido

### 3.5 — UX Improvements (U1-U5)
- **Objetivo:** Polish de experiência do usuário
- **Problema resolvido:** Empty states, confirmação de saída, indicador de sync
- **Esforço:** Médio (5 melhorias independentes)
- **Risco:** Nenhum
- **Dependências:** 3.1 (skeleton no Kanban depende da paginação)
- **Resultado:** App mais polido e profissional

---

## Riscos por Horizonte

### Curto Prazo (1-3 meses)
- **Egress Supabase** cresce com número de orgs (leads sem paginação)
- **Race condition** em `generateCode()` pode gerar contratos duplicados
- **Edge Functions penduradas** consomem invocações sem resultado
- **Erros silenciosos** em produção não detectados (sem Sentry ativo)

### Médio Prazo (3-6 meses)
- **`ai_router_logs`** cresce 5GB/mês com 100 orgs (billing extra Supabase)
- **`useProperties.ts`** com 930 linhas se torna unmaintainable
- **CORS `*`** explorado em ataque de phishing
- **Tokens OAuth** expostos em eventual breach

### Longo Prazo (6-12 meses)
- **Kanban inutilizável** com 5.000+ leads por org
- **70+ Edge Functions** com padrões divergentes custam exponencialmente mais para manter
- **Falta de versionamento de API** bloqueia evolução de contratos
- **Sem feature flags** = cada deploy é tudo-ou-nada

---

## Backlog Técnico Executável

```
FASE 1 — CRÍTICO (Semana 1-2, ~15h)
[ ] 1.1 _shared/ (auth.ts, cors.ts, response.ts) — 4h
[ ] 1.2 fetchWithTimeout wrapper — 2h
[ ] 1.3 RPC delete_property_cascade — 2h
[ ] 1.4 RPC generate_contract_code — 1h
[ ] 1.5 Sentry nos catch blocks — 2h
[ ] 1.6 .limit() em queries sem cap — 1h

FASE 2 — ROBUSTEZ (Semana 3-4, ~15h)
[ ] 2.1 Zod validation (billing, ai-router, platform-signup) — 4h
[ ] 2.2 CORS allowlist — 2h
[ ] 2.3 Extrair useProperties e useLeads — 4h
[ ] 2.4 Fix permissão assistente DELETE — 1h
[ ] 2.5 Triggers audit (contracts, commissions) — 2h

FASE 3 — ESCALA (Semana 5-8, ~30h)
[ ] 3.1 Paginar useLeads por estágio — 12h
[ ] 3.2 Wrapper tipado invokeFunction<T> — 6h
[ ] 3.3 Criptografar OAuth tokens — 4h
[ ] 3.4 RPC compute_financial_summary — 2h
[ ] 3.5 UX improvements (U1-U5) — 6h
```

**Total estimado:** ~60h de desenvolvimento distribuídas em 8 semanas.

---

*Diagnóstico gerado por análise estática do código-fonte em 2026-03-23.*
