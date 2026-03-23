# Auditoria de Escalabilidade e Evolução Futura
**Data:** 2026-03-23 | **Escopo:** Arquitetura, dados, multi-tenant, internacionalização, canais, schema evolution

---

## Diagnóstico Geral

O app é um ERP imobiliário multi-tenant (SaaS) com ~75 Edge Functions, 77 hooks, 50+ tabelas e 11 integrações externas. A arquitetura atual funciona bem para **dezenas de organizações com centenas de registros cada**. Os principais gargalos aparecem ao escalar para centenas de orgs com milhares de registros.

**Pontos fortes:**
- Multi-tenant com RLS rigoroso (89 tabelas)
- RBAC via tabela separada `user_roles` com functions SQL
- Separação frontend/backend via Edge Functions
- React Query com staleTime e abort signals
- Storage multi-provider (Supabase, R2, Cloudinary)

**Pontos fracos:**
- Queries sem paginação em tabelas core (leads, properties)
- God Hooks (useProperties 930 linhas, useLeads 551 linhas)
- 75 Edge Functions sem shared infrastructure
- Lógica de negócio no frontend (geração de código, cálculos financeiros)
- Sem versionamento de API
- Sem feature flags
- Sem internacionalização

---

## 1. Riscos de Crescimento

### 1.1 — Crescimento de Usuários

| Faixa | Status | Risco |
|-------|--------|-------|
| 10-50 orgs | ✅ OK hoje | Nenhum |
| 50-200 orgs | ⚠️ | `useLeads` carrega tudo; egress explode |
| 200-1000 orgs | 🔴 | Supabase Pro com 8GB storage saturado; `ai_router_logs` cresce 5GB/mês |
| 1000+ orgs | 🔴 | Necessita read replicas, connection pooling, possível separação de serviços |

**Decisão que parece simples mas custa caro:** Manter `useLeads` sem paginação. Hoje funciona; com 500 leads/org, cada sessão transfere 250KB. Com 2000 leads/org × 200 orgs, são 1000 sessões/dia × 1MB = 1GB/dia de egress só em leads.

### 1.2 — Crescimento de Volume de Dados

| Tabela | Crescimento | Risco | Solução |
|--------|-------------|-------|---------|
| `leads` | Linear com orgs | Alto — sem paginação | Paginação por estágio |
| `properties` | Linear com orgs | Médio — paginado (200/page) | OK |
| `ai_router_logs` | Linear com uso de IA | Alto — sem TTL nativo | `cleanup_cost_logs()` já criado |
| `property_images` | Supralinear (10-50 imgs/prop) | Médio | R2 com lifecycle rules |
| `lead_interactions` | Supralinear (5-20/lead) | Médio | Sem paginação no painel |
| `audit_events` | Linear com CUD ops | Baixo | pg_cron cleanup |
| `billing_webhook_logs` | Linear com pagamentos | Baixo | TTL 90 dias |
| `activity_log` | Linear com uso | Baixo | TTL 90 dias |

### 1.3 — Crescimento de Complexidade do Negócio

| Cenário | Preparação Atual | Gap |
|---------|-----------------|-----|
| Novos tipos de usuário | `app_role` enum extensível | Precisa migration para adicionar valor |
| Novos planos | `subscription_plans` dinâmico | ✅ OK |
| Novos estados (contratos, leads) | Enums no banco | Migration para cada novo estado |
| Permissões mais finas | 6 roles hierárquicos | Sem permissões por módulo/feature |
| Regras por parceiro | Sem suporte | Backlog longo prazo |

---

## 2. Pontos que Podem Travar Evolução

### 2.1 — God Hooks bloqueiam modularização
`useProperties.ts` (930 linhas) e `useLeads.ts` (551 linhas) concentram CRUD, imagens, owners, reorder, bulk ops e lógica de negócio. Qualquer mudança em propriedades arrisca quebrar 15+ componentes.

**Custo futuro:** Impossível ter 2 devs trabalhando em properties simultaneamente sem conflito. Onboarding de novo dev leva horas só para entender o hook.

### 2.2 — Lógica de negócio no frontend
- `generateCode()` gera código de contrato via SELECT MAX no frontend (race condition)
- Cálculos financeiros (comissões, resumo) feitos em hooks
- Filtragem de leads por broker feita client-side (`mapped.filter(l => l.broker_id === user.id)`)

**Custo futuro:** Qualquer novo canal (mobile, API pública) precisa reimplementar toda essa lógica. Regras de negócio divergem entre canais.

### 2.3 — Sem versionamento de API
Edge Functions não têm versionamento. Qualquer mudança de payload quebra clientes existentes. Se o app tiver versão mobile ou parceiros integrados, não há como evoluir sem quebrar.

### 2.4 — Enum de roles no banco
`app_role` é enum PostgreSQL. Adicionar novo role requer migration (`ALTER TYPE app_role ADD VALUE`). Não é reversível — não se pode remover um valor de enum em Postgres.

**Alternativa futura:** Tabela `roles` com permissões dinâmicas (quando necessário, não agora).

### 2.5 — Hardcoded strings de UI em português
Todos os textos estão hardcoded nos componentes. Internacionalização requer tocar em centenas de arquivos.

---

## 3. Decisões Simples que Custam Caro Depois

| Decisão Atual | Custo Futuro | Quando Dói |
|---------------|-------------|------------|
| Leads sem paginação | Rewrite do Kanban inteiro | 500+ leads/org |
| Código de contrato no frontend | Race conditions em equipes | 2+ usuários criando contratos |
| `select('*')` em hooks (já parcialmente corrigido) | Egress duplica com cada coluna nova | Qualquer adição de coluna |
| Textos hardcoded em PT-BR | Rewrite de 100+ componentes para i18n | Expansão para outro país |
| Roles como enum | Migration irreversível para cada novo role | Necessidade de role custom |
| CORS `*` em todas functions | Vetor de phishing | Qualquer ataque direcionado |
| Sem feature flags | Deploy = tudo ou nada | A/B testing, rollout gradual |

---

## 4. Multi-Tenant: Avaliação

| Aspecto | Status | Nota |
|---------|--------|------|
| Isolamento de dados | ✅ | RLS em 89 tabelas com `organization_id` |
| Branding por tenant | ✅ | `brand_settings` com cores, logo, slogan |
| Configurações por tenant | ✅ | `lead_stages`, `property_types` por org |
| Billing por tenant | ✅ | `subscriptions` + `billing_payments` |
| Limites por tenant | ⚠️ | Apenas IA tem rate limiting; sem limite de leads/properties/users |
| Auditoria separada | ✅ | `audit_events` com `organization_id` |
| Regras customizadas | ⚠️ | Sem engine de regras; lógica hardcoded |

**Melhoria incremental:** Adicionar `plan_limits` (max_leads, max_properties, max_users) à tabela `subscription_plans` e enforcement via RLS ou trigger.

---

## 5. Internacionalização: Avaliação

| Aspecto | Status | Esforço para Suportar |
|---------|--------|-----------------------|
| Idioma da UI | 🔴 PT-BR hardcoded | Alto (100+ componentes) |
| Moeda | ⚠️ R$ hardcoded nos formatters | Médio |
| Datas | ✅ date-fns com locale | Baixo (já usa `ptBR`) |
| Timezone | ⚠️ `new Date()` sem timezone explícita | Médio |
| Formato de números | ⚠️ Hardcoded BR format | Médio |

**Recomendação:** Não investir em i18n agora. O mercado é BR. Quando/se expandir, adotar `react-intl` ou `i18next` com extração automática de strings.

---

## 6. Expansão de Canais: Preparação

| Canal | Viabilidade | Bloqueio Principal |
|-------|------------|-------------------|
| Web App (atual) | ✅ | — |
| App Mobile (PWA) | ⚠️ | `vite-plugin-pwa` instalado mas sem service worker robusto |
| App Mobile (nativo) | 🔴 | Lógica de negócio no frontend; sem API REST pura |
| API Pública | 🔴 | Edge Functions não versionadas; sem docs; sem API keys para terceiros |
| Painel Admin | ✅ | Já existe em `/admin` |
| Webhooks (incoming) | ✅ | Meta, RD Station, Asaas já integrados |
| Webhooks (outgoing) | 🔴 | Sem sistema de webhook para notificar integrações externas |
| Chatbot | ⚠️ | `ticket-chat` existe mas é limitado |

**Melhoria incremental para mobile nativo:** Mover lógica de negócio para Edge Functions/RPCs. O frontend deve ser "thin client" — apenas UI e chamadas.

---

## 7. Evolução de Schema: Riscos

| Operação | Risco | Mitigação |
|----------|-------|-----------|
| Adicionar coluna nullable | ✅ Seguro | Default NULL, sem breaking change |
| Adicionar coluna NOT NULL | ⚠️ | Precisa DEFAULT ou backfill |
| Renomear coluna | 🔴 | Quebra frontend + Edge Functions + RLS |
| Mudar tipo de coluna | 🔴 | Pode perder dados |
| Adicionar valor a enum | ⚠️ | Migration necessária, não reversível |
| Remover valor de enum | 🔴 | Impossível em Postgres |
| Dividir tabela | 🔴 | Requer views de compatibilidade |

**Padrão recomendado para evoluções seguras:**
1. Adicionar nova coluna (nullable)
2. Deploy código que escreve em ambas (nova e antiga)
3. Backfill dados antigos
4. Deploy código que lê da nova
5. (Opcional) Remover coluna antiga depois de semanas

---

## 8. Escalabilidade Organizacional (Time de Devs)

| Aspecto | Status | Ação |
|---------|--------|------|
| Ownership claro | ⚠️ | Hooks monolíticos → 1 dev por feature é difícil |
| Divisão por módulos | ⚠️ | Tudo em `src/hooks/`, `src/pages/`, `src/components/` flat |
| Onboarding técnico | ✅ | Docs existem (`ESTRUTURA_DADOS.md`, auditorias) |
| Convenções | ⚠️ | Sem lint rules para padrões de hook/component |
| Documentação | ✅ | Boa cobertura de docs |
| Conhecimento concentrado | ⚠️ | `useProperties` e `useLeads` são "tribal knowledge" |

**Melhoria incremental:** Organizar por domínio: `src/modules/crm/`, `src/modules/properties/`, `src/modules/financial/`. Cada módulo com seus hooks, components e types.

---

## 9. Proposta de Melhorias Incrementais

### Curto Prazo (1-2 semanas) — Sem risco, impacto imediato

| # | Melhoria | Esforço | Impacto |
|---|----------|---------|---------|
| C1 | RPC `generate_contract_code()` — elimina race condition | Baixo | Alto |
| C2 | RPC `delete_property_cascade()` — deleção atômica | Baixo | Alto |
| C3 | `_shared/fetch.ts` com timeout 15s | Baixo | Alto |
| C4 | `_shared/response.ts` envelope padronizado | Baixo | Médio |
| C5 | `.limit()` em queries sem cap (`useAuditLog`, `useAiRouterStats`) | Baixo | Médio |
| C6 | Plan limits enforcement básico (max_leads via trigger) | Baixo | Alto (produto) |

### Médio Prazo (3-6 semanas) — Estrutural, sem breaking change

| # | Melhoria | Esforço | Impacto |
|---|----------|---------|---------|
| M1 | Extrair `usePropertyCRUD`, `usePropertyImages`, `usePropertyOwners` | Médio | Alto (manutenção) |
| M2 | Extrair `useLeadCRUD`, `useLeadBulkOps`, `useLeadKanban` | Médio | Alto (manutenção) |
| M3 | Organizar por domínio (`src/modules/`) | Médio | Alto (time scale) |
| M4 | Paginar `useLeads` por estágio | Alto | Crítico (escala) |
| M5 | Mover cálculos financeiros para RPC | Médio | Alto (multi-canal) |
| M6 | CORS allowlist em Edge Functions | Baixo | Médio (segurança) |

### Longo Prazo (2-6 meses) — Evolução de produto

| # | Melhoria | Esforço | Impacto |
|---|----------|---------|---------|
| L1 | Feature flags (tabela `feature_flags` + hook `useFeatureFlag`) | Médio | Alto (rollout) |
| L2 | Outgoing webhooks (notificar sistemas externos de eventos) | Alto | Alto (ecossistema) |
| L3 | API pública versionada para parceiros | Alto | Alto (plataforma) |
| L4 | Permissões por módulo (substituir enum por tabela) | Alto | Alto (enterprise) |
| L5 | i18n com react-intl (quando expandir) | Alto | Alto (mercado) |
| L6 | Read replicas para dashboards pesados | Alto | Alto (performance) |

---

## 10. Estratégia para Escalar sem Reescrever

### Princípio: "Strangler Fig Pattern"

Não reescrever. Envolver o código existente com abstrações mínimas e substituir por dentro.

```
1. Criar nova implementação ao lado da antiga
2. Redirecionar consumers gradualmente
3. Remover a antiga quando não tiver mais uso
```

### Aplicação prática:

**useProperties (930 linhas):**
```
Hoje: useProperties() retorna tudo
Passo 1: Criar usePropertyCRUD(), usePropertyImages() que delegam para useProperties internamente
Passo 2: Migrar components para usar os hooks específicos
Passo 3: Mover lógica de useProperties para os hooks específicos
Passo 4: useProperties() vira re-export dos específicos
```

**Edge Functions:**
```
Hoje: Cada function tem auth/cors/response inline
Passo 1: Criar _shared/ modules
Passo 2: Novas functions usam _shared/
Passo 3: Migrar functions existentes 1 por vez (quando tocar nelas)
Passo 4: Em 3 meses, todas usam _shared/
```

**Kanban leads:**
```
Hoje: Carrega todos os leads
Passo 1: Criar RPC get_leads_by_stage(stage_id, limit, offset)
Passo 2: Criar useLeadsByStage() que usa o RPC
Passo 3: Modificar KanbanColumn para usar useLeadsByStage ao invés de filtrar do array completo
Passo 4: Remover carregamento global de leads do Kanban (manter para listagem/busca)
```

---

## 11. Backlog Priorizado

```
SPRINT 1 — Foundation (Semana 1-2, ~12h)
[ ] C1: RPC generate_contract_code() — 1h
[ ] C2: RPC delete_property_cascade() — 2h
[ ] C3: _shared/fetch.ts (timeout) — 1h
[ ] C4: _shared/response.ts (envelope) — 2h
[ ] C5: .limit() em queries sem cap — 1h
[ ] C6: Plan limits (max_leads trigger) — 3h
[ ] C7: _shared/auth.ts + _shared/cors.ts — 2h

SPRINT 2 — Modularização (Semana 3-4, ~16h)
[ ] M1: Extrair usePropertyCRUD/Images/Owners — 6h
[ ] M2: Extrair useLeadCRUD/BulkOps/Kanban — 6h
[ ] M5: RPCs financeiros (compute_financial_summary) — 2h
[ ] M6: CORS allowlist — 2h

SPRINT 3 — Escala (Semana 5-8, ~20h)
[ ] M3: Organizar por domínio (src/modules/) — 8h
[ ] M4: Paginar useLeads por estágio — 12h

SPRINT 4 — Produto (Semana 9-12, ~20h)
[ ] L1: Feature flags — 6h
[ ] L2: Outgoing webhooks — 8h
[ ] L4: Permissões por módulo — 6h

BACKLOG (quando houver sinal real)
[ ] L3: API pública — quando parceiros pedirem
[ ] L5: i18n — quando expandir para fora do BR
[ ] L6: Read replicas — quando dashboards ficarem lentos
```

---

## 12. Resumo de Recomendações

### NÃO fazer agora (overengineering):
- ❌ Microserviços
- ❌ Event sourcing
- ❌ GraphQL
- ❌ i18n completo
- ❌ API pública versionada
- ❌ CQRS
- ❌ Read replicas

### FAZER agora (sinais claros):
- ✅ RPCs atômicos (race conditions reais)
- ✅ Timeout em fetches externos (functions penduradas reais)
- ✅ Plan limits enforcement (produto precisa)
- ✅ Modularizar hooks monolíticos (manutenção diária)
- ✅ Shared infrastructure em Edge Functions (duplicação real)

### PREPARAR para depois (deixar pontos de extensão):
- 🟡 Feature flags (tabela simples, sem engine complexa)
- 🟡 Envelope de resposta padronizado (facilita versionamento futuro)
- 🟡 Organização por domínio (facilita ownership quando time crescer)
- 🟡 Paginar leads (será necessário em 3-6 meses)

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
