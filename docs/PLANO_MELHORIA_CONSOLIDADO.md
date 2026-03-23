# Plano Consolidado de Melhoria — Porta do Corretor
**Data:** 2026-03-23 | **Base:** 89k LOC, 73 Edge Functions, 89 tabelas, 45+ rotas

---

## 1. Top 10 Problemas Mais Graves

| # | Problema | Camada | Juros Cobrados |
|---|---------|--------|---------------|
| P1 | `useLeads` carrega TODOS os leads sem paginação | Frontend | 5MB/sessão; UI trava em mobile; egress cresce linearmente |
| P2 | Filtro de leads por broker feito no frontend (`filter`), não via RLS | Segurança | Todos os leads trafegam para o corretor; bypassável via DevTools |
| P3 | `generateCode()` no frontend com race condition | Integridade | Contratos duplicados em uso simultâneo |
| P4 | Deleção de imóvel com 4 DELETEs sem transação | Integridade | Orphans no banco (imagens, owners sem imóvel) |
| P5 | 73 Edge Functions sem _shared/ (auth, CORS, response) | Manutenção | 900+ linhas duplicadas; 6 formatos de erro diferentes |
| P6 | `useProperties.ts` com 930 linhas (God Hook) | Manutenção | Qualquer mudança em imóveis arrisca quebrar tudo |
| P7 | 5 testes para 89k linhas de código (0.005% cobertura) | Qualidade | 100% validação manual; regressões invisíveis |
| P8 | Cálculos financeiros no frontend (reduce em hooks) | Arquitetura | Fonte da verdade dispersa; dashboard lento; inconsistência |
| P9 | Sem timeout em fetches externos (Asaas, Meta, Cloudinary) | Resiliência | Edge Functions penduradas até 150s; invocação desperdiçada |
| P10 | OAuth tokens em texto plano no banco | Segurança | Breach expõe tokens Meta/RD Station com acesso a contas de anúncios |

---

## 2. Top 10 Melhorias com Maior Impacto

| # | Melhoria | Impacto | Esforço |
|---|---------|---------|---------|
| M1 | RLS para filtro de leads por broker | Segurança + performance (menos dados trafegando) | Baixo |
| M2 | RPCs atômicos (delete_property, generate_code, financial_summary) | Integridade + performance | Baixo |
| M3 | `_shared/` infrastructure (auth, cors, response, fetch) | -900 linhas duplicadas; padronização | Médio |
| M4 | Paginar `useLeads` por estágio | Kanban escalável para 10k+ leads | Alto |
| M5 | Testes unitários para hooks core (useLeads, useProperties, useContracts) | Regressões detectadas antes do deploy | Médio |
| M6 | Quebrar hooks monolíticos (useProperties 930L, useLeads 551L) | Manutenibilidade; blast radius reduzido | Médio |
| M7 | `fetchWithTimeout` em fetches externos | Elimina functions penduradas | Baixo |
| M8 | Sentry ativo nos catch blocks de mutations | Observabilidade real de erros | Baixo |
| M9 | Wrapper tipado `invokeFunction<TInput, TOutput>` | Type safety em 434 call sites | Médio |
| M10 | Mover 36 `supabase.from()` de components para hooks | Separação apresentação/dados | Médio |

---

## 3. Quick Wins (< 2h cada)

| # | Mudança | Esforço | Impacto |
|---|---------|---------|---------|
| QW1 | `fetchWithTimeout` wrapper | 1h | Resiliência em 20+ functions |
| QW2 | RPC `generate_contract_code()` | 1h | Fix race condition |
| QW3 | `Sentry.captureException` em 15 mutations | 2h | Observabilidade |
| QW4 | `.limit()` em queries sem cap (useAuditLog, useAiRouterStats) | 1h | Protege contra leitura ilimitada |
| QW5 | `staleTime` em 5 hooks restantes | 30min | Reduz refetch desnecessário |
| QW6 | `Cache-Control` em Edge Functions públicas (og-metadata, portal-xml-feed) | 30min | Reduz invocações |
| QW7 | Fix 4 vulnerabilidades high (serialize-javascript, vite-plugin-pwa) | 30min | Segurança de deps |

---

## 4. Mudanças Estruturais

| # | Mudança | Risco | Resultado |
|---|---------|-------|----------|
| E1 | Extrair useProperties → usePropertyCRUD + Images + Owners | Baixo | 3 hooks de ~200L vs 1 de 930L |
| E2 | Extrair useLeads → useLeadCRUD + Kanban + BulkOps | Baixo | Hooks com responsabilidade única |
| E3 | Split Settings.tsx em 5 sub-componentes | Baixo | Arquivo grande → focado |
| E4 | Mover 36 supabase.from() de components para hooks | Baixo | Separação camadas |
| E5 | Criar src/modules/ por domínio (crm, properties, financial, contracts, billing) | Médio | Navegabilidade; onboarding -75% |

---

## 5. Mudanças de Arquitetura

| # | Mudança | De → Para |
|---|---------|-----------|
| A1 | Filtro de leads por broker | Frontend filter → RLS policy |
| A2 | Código de contrato | Frontend MAX+1 → RPC com sequence/FOR UPDATE |
| A3 | Deleção de imóvel | 4 DELETEs → RPC delete_property_cascade() |
| A4 | Cálculos financeiros | Frontend reduce → RPC compute_financial_summary() |
| A5 | Comissões agregadas | Frontend reduce → RPC compute_commission_summary() |
| A6 | Auth em Edge Functions | Inline 73x → _shared/auth.ts |
| A7 | CORS em Edge Functions | `*` hardcoded → allowlist dinâmica |
| A8 | Paginação de leads | Todos em memória → Lazy load por estágio |

---

## 6. Mudanças de DX e Processo

| # | Mudança | Problema Resolvido |
|---|---------|-------------------|
| DX1 | Testes unitários em hooks core | Regressões descobertas só em produção |
| DX2 | Wrapper tipado invokeFunction<T> | 434 chamadas sem autocomplete |
| DX3 | _shared/response.ts envelope padronizado | 6 formatos de resposta de erro |
| DX4 | Docs: ADRs (Architecture Decision Records) | Decisões sem registro |
| DX5 | Zod validation em billing, ai-router, platform-signup | Erros obscuros por payload inválido |
| DX6 | Cleanup de exports não utilizados (~15 candidatos) | Código morto aumenta confusão |

---

## 7. Mudanças de Custo e Operação

| # | Mudança | Economia Estimada |
|---|---------|------------------|
| C1 | Paginar leads (reduz egress) | -60% egress Supabase no CRM |
| C2 | RPC financial_summary (1 query vs 4) | -75% round trips financeiro |
| C3 | Cache-Control em functions públicas | -50% invocações og-metadata/xml-feed |
| C4 | pg_cron cleanup ai_router_logs (5GB/mês com 100 orgs) | Controla storage Pro |
| C5 | fetchWithTimeout (15s vs 150s) | Invocações que penduram consomem quota |
| C6 | Rate limiting em send-reset-email | Previne abuse de quota email |

---

## 8. Mudanças de Modularização e Fronteiras

| # | De | Para | Ganho |
|---|---|------|-------|
| F1 | Leads filtrados client-side por broker | RLS no banco | Segurança + menos dados |
| F2 | Lógica de negócio em hooks | RPCs no banco | Fonte da verdade única |
| F3 | 36 components com supabase.from() | Components usam hooks | Separação de camadas |
| F4 | src/hooks/ monolítico | src/modules/{domain}/hooks/ | Navegabilidade |
| F5 | billing Edge Function com ?action=X | Ações separadas internamente | Clareza de roteamento |
| F6 | Auth inline em 73 functions | _shared/auth.ts | DRY; manutenção centralizada |

---

## 9. Riscos de Não Agir

| Horizonte | Risco | Consequência |
|-----------|-------|-------------|
| **1-3 meses** | Race condition em generateCode() | Contratos duplicados em produção |
| **1-3 meses** | Leads sem paginação + orgs crescendo | UI travando; egress estourando plano |
| **1-3 meses** | Erros silenciosos (sem Sentry ativo) | Bugs não detectados; churn |
| **3-6 meses** | ai_router_logs crescendo 5GB/mês | Billing extra Supabase Pro |
| **3-6 meses** | useProperties 930L + sem testes | Medo de mexer; velocidade cai |
| **3-6 meses** | CORS * explorado | Phishing via API |
| **6-12 meses** | 73 Edge Functions divergentes | Custo de manutenção exponencial |
| **6-12 meses** | Kanban inutilizável com 5k+ leads | Feature core do CRM quebrada |
| **6-12 meses** | Sem feature flags | Deploy tudo-ou-nada; rollback caro |
| **12+ meses** | Sem API versionada | Impossível evoluir contratos |

---

## 10. Ordem Recomendada de Implementação

```
Semana 1-2: Quick Wins + Segurança Imediata
├── QW1-QW7 (todos os quick wins)
├── A1: RLS para filtro de leads por broker
├── A2: RPC generate_contract_code()
└── A3: RPC delete_property_cascade()

Semana 3-4: Padronização Backend
├── A6: _shared/ (auth, cors, response, fetch)
├── DX5: Zod validation em functions críticas
├── A7: CORS allowlist
└── M8: Sentry nos catch blocks

Semana 5-6: Modularização Frontend
├── E1: Extrair useProperties (3 hooks)
├── E2: Extrair useLeads (3 hooks)
├── E3: Split Settings.tsx
└── E4: Mover supabase.from() para hooks

Semana 7-8: Escalabilidade
├── A8: Paginar useLeads por estágio
├── A4: RPC compute_financial_summary()
├── M9: Wrapper tipado invokeFunction<T>
└── DX1: Testes unitários hooks core

Semana 9-10: Refinamento
├── E5: Reorganizar em src/modules/
├── C4: pg_cron cleanup logs
├── A5: RPC compute_commission_summary()
└── DX6: Cleanup código morto
```

---

## FASE 1 — Redução de Risco e Simplificação (Semana 1-4, ~25h)

### 1.1 — RLS para filtro de leads por broker
- **Objetivo:** Leads do corretor filtrados pelo banco, não pelo frontend
- **Problema resolvido:** Todos os leads trafegam para o corretor; bypassável
- **Esforço:** Baixo (1 migration RLS + remover filter no hook)
- **Risco:** Baixo (RLS já existe para org; adiciona filtro por broker_id)
- **Dependências:** Nenhuma
- **Resultado:** Corretor recebe apenas seus leads; impossível burlar

### 1.2 — RPC generate_contract_code()
- **Objetivo:** Código de contrato único garantido pelo banco
- **Problema resolvido:** Race condition com MAX+1 no frontend
- **Esforço:** Baixo (1 migration + 1 mudança em useContracts)
- **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Zero duplicatas

### 1.3 — RPC delete_property_cascade()
- **Objetivo:** Deleção atômica de imóvel com todas as dependências
- **Problema resolvido:** Orphans no banco por falha parcial
- **Esforço:** Baixo (1 migration + 1 mudança em useProperties)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Integridade referencial garantida

### 1.4 — Quick Wins (QW1-QW7)
- **Objetivo:** Ganhos imediatos em resiliência, observabilidade e segurança
- **Problema resolvido:** Functions penduradas, erros silenciosos, deps vulneráveis
- **Esforço:** Baixo (7 itens × 30min-2h)
- **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Base mais sólida para as próximas fases

### 1.5 — _shared/ infrastructure + CORS allowlist
- **Objetivo:** Centralizar auth, CORS, response e fetch em módulos reutilizáveis
- **Problema resolvido:** 900 linhas duplicadas; CORS aberto; 6 formatos de erro
- **Esforço:** Médio (criar módulos + migrar 5 functions piloto)
- **Risco:** Baixo (aditivo)
- **Dependências:** Nenhuma
- **Resultado:** Padrão para migração gradual das 73 functions

### 1.6 — Sentry ativo + Zod em functions críticas
- **Objetivo:** Erros capturados automaticamente; payloads validados
- **Problema resolvido:** Erros silenciosos; billing quebra com dados malformados
- **Esforço:** Baixo-Médio
- **Risco:** Nenhum
- **Dependências:** 1.5 (response padronizado)
- **Resultado:** Observabilidade e validação

---

## FASE 2 — Sustentação e Escalabilidade Saudável (Semana 5-8, ~30h)

### 2.1 — Extrair hooks monolíticos
- **Objetivo:** useProperties (930L) → 3 hooks; useLeads (551L) → 3 hooks
- **Problema resolvido:** God hooks com blast radius alto
- **Esforço:** Médio (refatorar + atualizar ~30 imports)
- **Risco:** Baixo (refactor puro)
- **Dependências:** Nenhuma
- **Resultado:** Hooks de ~200L com responsabilidade única

### 2.2 — Mover supabase.from() de components para hooks
- **Objetivo:** 36 componentes deixam de acessar DB diretamente
- **Problema resolvido:** Lógica de dados espalhada na camada de apresentação
- **Esforço:** Médio (4h)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Separação clara apresentação ↔ dados

### 2.3 — Paginar useLeads por estágio
- **Objetivo:** Kanban escalável com lazy load por coluna
- **Problema resolvido:** 5MB/sessão com 10 orgs × 1000 leads; UI trava
- **Esforço:** Alto (Kanban refactor + RPC + infinite scroll)
- **Risco:** Médio (UX do drag-and-drop pode precisar ajuste)
- **Dependências:** Índice composto `(organization_id, lead_stage_id, position)`
- **Resultado:** Kanban funcional com 10.000+ leads

### 2.4 — RPCs financeiros
- **Objetivo:** compute_financial_summary() e compute_commission_summary()
- **Problema resolvido:** 4 queries + reduce no frontend; dashboard lento
- **Esforço:** Baixo (2 RPCs + 2 hooks)
- **Risco:** Baixo
- **Dependências:** Nenhuma
- **Resultado:** Dashboard financeiro 3-4x mais rápido

### 2.5 — Testes unitários para hooks core
- **Objetivo:** Cobertura mínima em useLeads, useProperties, useContracts
- **Problema resolvido:** 0.005% cobertura; regressões invisíveis
- **Esforço:** Médio (setup vitest + 15-20 testes)
- **Risco:** Nenhum
- **Dependências:** 2.1 (hooks menores são mais testáveis)
- **Resultado:** Regressões detectadas antes do deploy

---

## FASE 3 — Preparação para Crescimento e Expansão (Semana 9-12, ~25h)

### 3.1 — Reorganizar em src/modules/
- **Objetivo:** Estrutura por domínio (crm, properties, financial, contracts, billing, ads, admin)
- **Problema resolvido:** Dev não sabe onde está o código; onboarding lento
- **Esforço:** Alto (mover + atualizar imports em ~100 arquivos)
- **Risco:** Médio (muitos imports mudam)
- **Dependências:** 2.1 (hooks já extraídos)
- **Resultado:** Navegabilidade; onboarding -75%

### 3.2 — Wrapper tipado invokeFunction<TInput, TOutput>
- **Objetivo:** Type safety em 434 chamadas de Edge Functions
- **Problema resolvido:** `any` em tudo; erros só em runtime
- **Esforço:** Médio (wrapper + types + migração gradual)
- **Risco:** Nenhum (aditivo)
- **Dependências:** Nenhuma
- **Resultado:** Autocomplete e validação em compile time

### 3.3 — Criptografar OAuth tokens
- **Objetivo:** Tokens Meta/RD Station cifrados em repouso
- **Problema resolvido:** Breach expõe tokens de anúncios
- **Esforço:** Médio (encrypt/decrypt em Edge Functions)
- **Risco:** Médio (perder chave = perder tokens)
- **Dependências:** Secret ENCRYPTION_KEY no Supabase
- **Resultado:** Dados sensíveis protegidos

### 3.4 — UX improvements (empty states, confirmação de saída, sync indicator)
- **Objetivo:** Polish de experiência do usuário
- **Problema resolvido:** Confusão "sem dados" vs "erro"; perda de formulários
- **Esforço:** Médio (5 melhorias independentes)
- **Risco:** Nenhum
- **Dependências:** 2.3 (skeleton no Kanban)
- **Resultado:** App mais profissional

### 3.5 — pg_cron cleanup + rate limiting + observabilidade
- **Objetivo:** Operação sustentável a longo prazo
- **Problema resolvido:** ai_router_logs 5GB/mês; abuse em send-reset-email
- **Esforço:** Baixo
- **Risco:** Nenhum
- **Dependências:** Nenhuma
- **Resultado:** Custos controlados; abuse prevenido

---

## Backlog Técnico Executável

```
FASE 1 — RISCO E SIMPLIFICAÇÃO (Semana 1-4, ~25h)
[ ] 1.1  RLS filtro broker em leads ................. 2h  [Segurança]  [P0]
[ ] 1.2  RPC generate_contract_code() ............... 1h  [Integridade] [P0]
[ ] 1.3  RPC delete_property_cascade() .............. 2h  [Integridade] [P0]
[ ] 1.4a fetchWithTimeout wrapper ................... 1h  [Resiliência] [P0]
[ ] 1.4b Sentry nos catch blocks .................... 2h  [Observ.]     [P0]
[ ] 1.4c .limit() em queries sem cap ................ 1h  [Performance] [P1]
[ ] 1.4d staleTime em hooks restantes ............... 0.5h [Performance] [P1]
[ ] 1.4e Cache-Control em functions públicas ........ 0.5h [Custo]       [P1]
[ ] 1.4f Fix deps vulneráveis (serialize-js, pwa) .. 0.5h [Segurança]   [P0]
[ ] 1.5  _shared/ (auth, cors, response, fetch) .... 4h  [Manutenção]  [P0]
[ ] 1.5b CORS allowlist ............................. 2h  [Segurança]   [P1]
[ ] 1.6a Sentry ativo em mutations .................. 2h  [Observ.]     [P1]
[ ] 1.6b Zod em billing, ai-router, platform-signup . 3h  [Validação]   [P1]
[ ] 1.6c Cleanup exports mortos (~15) ............... 1h  [DX]          [P2]

FASE 2 — SUSTENTAÇÃO E ESCALABILIDADE (Semana 5-8, ~30h)
[ ] 2.1a useProperties → CRUD + Images + Owners .... 6h  [Manutenção]  [P1]
[ ] 2.1b useLeads → CRUD + Kanban + BulkOps ........ 6h  [Manutenção]  [P1]
[ ] 2.2  Mover 36 supabase.from() para hooks ........ 4h  [Arquitetura] [P1]
[ ] 2.2b Split Settings.tsx em sub-componentes ...... 2h  [Manutenção]  [P2]
[ ] 2.3  Paginar useLeads por estágio ............... 10h [Escala]       [P0]
[ ] 2.4  RPCs financeiros (summary + commissions) ... 3h  [Performance] [P1]
[ ] 2.5  Testes unitários hooks core ................ 6h  [Qualidade]   [P1]

FASE 3 — CRESCIMENTO E EXPANSÃO (Semana 9-12, ~25h)
[ ] 3.1  Reorganizar src/modules/ ................... 8h  [DX]          [P2]
[ ] 3.2  Wrapper tipado invokeFunction<T> ........... 6h  [Type Safety] [P2]
[ ] 3.3  Criptografar OAuth tokens .................. 4h  [Segurança]   [P1]
[ ] 3.4  UX improvements (5 itens) .................. 5h  [UX]          [P2]
[ ] 3.5  pg_cron + rate limiting + monitoring ....... 2h  [Operação]    [P1]
```

**Total: ~80h em 12 semanas.**
Corrige todas as violações críticas, modulariza, escala e prepara para crescimento — sem reescrever o sistema.

---

## Resumo Visual

```
                    IMPACTO
                    ▲
                    │  P2(leads RLS)  P1(paginação)
            ALTO    │  P3(code race)  M5(testes)
                    │  P4(delete)     M6(hooks split)
                    │
            MÉDIO   │  P5(shared)     M9(typed invoke)
                    │  M8(sentry)     E5(modules)
                    │  M7(timeout)    
                    │
            BAIXO   │  QW4(limit)     3.4(UX)
                    │  QW5(stale)     DX6(cleanup)
                    │
                    └──────────────────────────────► ESFORÇO
                       BAIXO    MÉDIO    ALTO
```

*Plano consolidado gerado em 2026-03-23 a partir das auditorias de velocidade, débito técnico e responsabilidades.*
