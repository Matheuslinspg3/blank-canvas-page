# Auditoria de Débito Técnico — Porta do Corretor
**Data:** 2026-03-23 | **Métricas:** 89k LOC, 73 Edge Functions, 5 testes, 4 deps vulneráveis

---

## Mapa do Débito Técnico

### Débito de Código

| Dívida | Severidade | Juros (custo recorrente) |
|--------|-----------|------------------------|
| **9 arquivos >700 linhas** (useProperties 930, LeadForm 938, Settings 935, etc.) | Crítico | ~2h/semana para localizar, entender e modificar |
| **~900 linhas de auth/CORS/response duplicadas** em 73 Edge Functions | Crítico | Bug fix → tocar N arquivos; ~4h/mês de retrabalho |
| **Lógica de negócio no frontend** (generateCode, filtro broker, cálculos) | Importante | Impossibilita multi-canal; regras divergem |
| **4 componentes mortos** (`ClarityMask`, `PageHeaderActions`, `PullToRefreshContainer`, `MetaSettingsContent`) | Cosmético | Confusão ao navegar; 0 custo funcional |
| **191 exports em hooks** sem verificação de uso | Cosmético | Surface area desnecessária |

### Débito de Arquitetura

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **Flat file structure** (`src/hooks/`, `src/components/`, `src/pages/`) sem domínios | Importante | Ownership impossível; qualquer dev toca qualquer arquivo |
| **3 storage providers simultâneos** (Supabase + R2 + Cloudinary) | Importante | 3 functions de upload, proxy e cleanup para manter |
| **`ai-router/index.ts` com 890 linhas** (monólito de routing) | Importante | Adicionar provider = tocar arquivo de 890 linhas |
| **`billing?action=X`** routing por query param | Cosmético | Funciona mas dificulta monitoring por endpoint |

### Débito de Dados

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **`generateCode()` no frontend sem lock** | Crítico | Race condition → contratos duplicados |
| **Deleção não-atômica** (4 DELETEs separados em `deleteProperty`) | Crítico | Orphans no banco |
| **`app_role` como enum PostgreSQL** | Importante | Adicionar role = migration irreversível |
| **OAuth tokens em texto plano** (`ad_accounts.auth_payload`) | Importante | Breach → tokens expostos |
| **`ai_router_logs` sem TTL nativo** | Importante | Cresce 5GB/mês com 100 orgs |

### Débito de Testes

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **5 testes para 89k LOC** (0.005% cobertura) | Crítico | Validação 100% manual; regressões não detectadas; medo de refatorar |
| **Zero testes para Edge Functions de billing** | Crítico | Mudança em cobrança sem rede de segurança |
| **Zero testes de integração** | Importante | Quebra entre frontend↔backend só aparece em produção |
| **Testes existentes são mocks puros** | Cosmético | Não validam comportamento real |

### Débito de Documentação

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **APIs sem documentação de payload** | Importante | Dev adivinha formato; erros em runtime |
| **Setup local não documentado** | Importante | Onboarding lento |
| **Sem CONTRIBUTING.md** | Cosmético | Convenções implícitas |
| **20+ docs existem ✅** (ESTRUTURA_DADOS, auditorias, changelogs) | — | Ponto forte |

### Débito de Segurança

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **4 deps com vulnerabilidades high** (serialize-javascript, vite-plugin-pwa chain) | Importante | Vetor de ataque em build pipeline |
| **CORS `*` em 70+ Edge Functions** | Importante | Qualquer origem invoca API |
| **`assistente` pode DELETE** em properties/appointments | Importante | Escalação de privilégio |
| **35 functions com `verify_jwt: false`** | Importante | Validação manual cobre mas é frágil |
| **Sem rate limiting em `send-reset-email`** | Cosmético | Abuse potencial |

### Débito de Observabilidade

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **Sentry instalado mas parcialmente ativo** | Importante | Erros em produção não detectados proativamente |
| **Sem correlação de request** entre frontend e Edge Functions | Cosmético | Debug de incidente cruzado é manual |
| **6 formatos de erro diferentes** em Edge Functions | Importante | Frontend não pode tratar erros de forma uniforme |

### Débito de UX

| Dívida | Severidade | Juros |
|--------|-----------|-------|
| **Kanban trava com >300 leads** | Crítico | Usuário abandona feature core |
| **Sem confirmação de saída** com dados não salvos | Importante | Usuário perde formulários longos |
| **Empty states inconsistentes** | Cosmético | Confusão "sem dados" vs "erro" |

---

## Classificação: Crítico vs. Importante vs. Cosmético

### 🔴 Crítico (cobrando juros altos agora)

1. **5 testes para 89k LOC** → medo de refatorar, regressões, validação manual
2. **God Hooks (930+551 linhas)** → cada mudança arrisca efeito colateral
3. **Race condition em `generateCode()`** → contratos duplicados em produção
4. **Deleção não-atômica** → orphans reais no banco
5. **Leads sem paginação** → Kanban inutilizável com crescimento
6. **73 Edge Functions sem shared code** → retrabalho a cada mudança

### 🟡 Importante (custo crescente, sem dor imediata)

7. CORS `*` em todas as functions
8. OAuth tokens em texto plano
9. 4 deps vulneráveis
10. Sentry parcialmente ativo
11. Lógica de negócio no frontend
12. 3 storage providers
13. Sem feature flags
14. Permissão `assistente` em DELETE
15. `ai_router_logs` sem TTL

### 🟢 Cosmético (baixo custo, pode esperar)

16. 4 componentes mortos
17. Sem CONTRIBUTING.md
18. `billing?action=X` routing
19. Sem correlação de request
20. Empty states inconsistentes

---

## Débito Consciente vs. Inconsciente

| Tipo | Exemplos | Como Chegou Aqui |
|------|---------|-----------------|
| **Consciente (para lançar rápido)** | Leads sem paginação, CORS `*`, 3 storage providers | Trade-off válido no MVP; hora de pagar |
| **Inconsciente (acumulou)** | God Hooks cresceram gradualmente; 73 functions sem shared code | Ninguém planejou ter 930 linhas; cresceu organicamente |
| **Herdado** | Cloudinary legacy; `verify_jwt: false` padrão | Decisões de infraestrutura original |
| **Por pressão de negócio** | Sem testes; lógica no frontend | Prioridade era entregar features |

---

## Plano de Pagamento por Etapas

### Sprint 1 — Parar o Sangramento (Semana 1-2, ~12h)

| # | Ação | Dívida Paga | Esforço | Risco |
|---|------|------------|---------|-------|
| 1.1 | RPC `generate_contract_code()` | Race condition | 1h | Nenhum |
| 1.2 | RPC `delete_property_cascade()` | Orphans | 2h | Nenhum |
| 1.3 | `_shared/auth.ts` + `cors.ts` + `response.ts` + `fetch.ts` | Duplicação + CORS | 3h | Baixo |
| 1.4 | Testes para `useLeads`, `useProperties`, `useContracts` | 0 → 3 hooks testados | 4h | Nenhum |
| 1.5 | Atualizar deps vulneráveis | 4 vulns high | 1h | Baixo |
| 1.6 | Remover 4 componentes mortos | Código morto | 30min | Nenhum |

### Sprint 2 — Modularizar (Semana 3-4, ~14h)

| # | Ação | Dívida Paga | Esforço | Risco |
|---|------|------------|---------|-------|
| 2.1 | Quebrar `useProperties` → 3 hooks | God Hook 930 linhas | 6h | Baixo |
| 2.2 | Quebrar `useLeads` → 3 hooks | God Hook 551 linhas | 6h | Baixo |
| 2.3 | Ativar Sentry em mutations | Observabilidade | 2h | Nenhum |

### Sprint 3 — Consolidar (Semana 5-6, ~12h)

| # | Ação | Dívida Paga | Esforço | Risco |
|---|------|------------|---------|-------|
| 3.1 | Split `Settings.tsx` (935 linhas) em 5 | God Component | 2h | Baixo |
| 3.2 | Split `GeradorAnuncios.tsx` (972 linhas) | God Page | 3h | Baixo |
| 3.3 | Split `PropertyDetails.tsx` (921 linhas) | God Page | 3h | Baixo |
| 3.4 | Testes para `billing` e `ai-router` Edge Functions | 0 → 2 functions testadas | 4h | Nenhum |

### Sprint 4 — Estruturar (Semana 7-8, ~12h)

| # | Ação | Dívida Paga | Esforço | Risco |
|---|------|------------|---------|-------|
| 4.1 | Organizar em `src/modules/` | Flat structure | 8h | Médio |
| 4.2 | Feature flags simples | Deploy tudo-ou-nada | 4h | Baixo |

### Backlog (quando tocar no código)

| Ação | Trigger |
|------|---------|
| Completar migração R2 | Quando Cloudinary cobrar |
| Paginar leads | Primeiro cliente com >500 leads |
| Criptografar OAuth tokens | Quando processar dados sensíveis para enterprise |
| Permissão `assistente` DELETE | Quando cliente reportar |
| Refatorar `ai-router/index.ts` | Quando adicionar novo provider |

---

## Backlog Técnico Priorizado

```
PRIORIDADE × ESFORÇO

    ALTO IMPACTO + BAIXO ESFORÇO (fazer primeiro)
    ├── 1.1 RPC generate_contract_code     [1h]  [Crítico]
    ├── 1.2 RPC delete_property_cascade    [2h]  [Crítico]
    ├── 1.5 Fix deps vulneráveis           [1h]  [Importante]
    ├── 1.6 Remover código morto           [30m] [Cosmético]
    └── 2.3 Sentry em mutations            [2h]  [Importante]

    ALTO IMPACTO + MÉDIO ESFORÇO (fazer em seguida)
    ├── 1.3 _shared/ infrastructure        [3h]  [Crítico]
    ├── 1.4 Testes hooks core              [4h]  [Crítico]
    ├── 2.1 Split useProperties            [6h]  [Crítico]
    ├── 2.2 Split useLeads                 [6h]  [Crítico]
    └── 3.4 Testes billing/ai-router       [4h]  [Importante]

    MÉDIO IMPACTO + BAIXO ESFORÇO
    ├── 3.1 Split Settings.tsx             [2h]  [Importante]
    ├── 3.2 Split GeradorAnuncios.tsx       [3h]  [Importante]
    └── 3.3 Split PropertyDetails.tsx       [3h]  [Importante]

    MÉDIO IMPACTO + MÉDIO ESFORÇO
    ├── 4.1 src/modules/ organization      [8h]  [Importante]
    └── 4.2 Feature flags                  [4h]  [Importante]

    BACKLOG (sem prazo, on-touch)
    ├── Migração Cloudinary → R2
    ├── Paginar leads
    ├── Criptografar OAuth
    └── Refatorar ai-router
```

**Total do plano:** ~50h em 8 semanas. Paga ~80% da dívida crítica e importante sem reescrever nada.

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
