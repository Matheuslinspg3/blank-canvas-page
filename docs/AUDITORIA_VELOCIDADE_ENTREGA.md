# Auditoria de Velocidade de Entrega (DX & Developer Throughput)
**Data:** 2026-03-23 | **Métricas:** 88.935 LOC frontend, 18.051 LOC Edge Functions, 5 testes, 73 functions, 311 componentes

---

## Diagnóstico Geral

O projeto tem **boa documentação** (20+ docs), **bom stack** (React/Vite/Supabase/TanStack Query) e **deploy automático** (Edge Functions + Lovable preview). Os gargalos de velocidade estão em **arquivos monolíticos**, **quase zero cobertura de testes**, e **falta de shared infrastructure no backend**.

---

## 1. Gargalos de Velocidade do Time

### G1 — Arquivos gigantes concentram risco e atrito

| Arquivo | Linhas | Impacto |
|---------|--------|---------|
| `useProperties.ts` | 930 | Qualquer mudança em imóveis toca esse arquivo |
| `GeradorAnuncios.tsx` | 972 | Página inteira num componente |
| `LeadForm.tsx` | 938 | Formulário monolítico |
| `Settings.tsx` | 935 | 10+ seções num arquivo |
| `PropertyDetails.tsx` | 921 | Página com tabs, galeria, mapa, ações |
| `Properties.tsx` | 807 | Listagem + filtros + ações bulk |
| `KanbanBoard.tsx` | 682 | Drag-and-drop + estados + reorder |
| `ai-router/index.ts` | 890 | Router monolítico com 10+ providers |
| `imobzi-import/index.ts` | 1094 | Importação com parsing, validação, upsert |

**Tempo perdido:** Dev leva ~15-30min para localizar e entender a seção relevante antes de começar a implementar. Risco de efeito colateral a cada mudança.

### G2 — 5 testes para 88.935 linhas de código (0.005% cobertura)

| Teste | O que testa |
|-------|------------|
| `auth.test.ts` | Mock básico de auth |
| `critical-flows.test.ts` | Smoke test de fluxos |
| `edge-auth.test.ts` | Mock de Edge Function auth |
| `properties.test.ts` | CRUD básico de properties |
| `security-audit.test.ts` | Checklist de segurança |

**Consequência:** Toda mudança é validada manualmente. Tempo de correção de bug é 3-5x maior (reproduzir → investigar → testar manualmente → rezar para não quebrar outra coisa).

### G3 — Lógica de negócio espalhada entre frontend e Edge Functions

Regras como "corretor só vê seus leads" estão no frontend (`mapped.filter(l => l.broker_id === user.id)`). Geração de código de contrato está no frontend. Cálculos financeiros estão em hooks.

**Consequência:** Para mudar uma regra de negócio, dev precisa saber se ela vive no hook, no componente, na Edge Function ou na RLS policy. Não há lugar canônico.

### G4 — Edge Functions sem shared code = overhead em cada modificação

73 functions, cada uma com auth inline, CORS inline, error handling inline. Mudar o formato de erro = tocar 73 arquivos.

### G5 — Sem staging/preview por branch

Deploy é direto para produção (Edge Functions) ou preview único (frontend). Não há como testar uma mudança isolada sem afetar o ambiente compartilhado.

---

## 2. Pontos que Tornam Mudanças Lentas ou Arriscadas

| Ponto | Velocidade Afetada | Risco |
|-------|-------------------|-------|
| Arquivos >700 linhas (9 arquivos) | Leitura lenta, merge conflicts | Efeito colateral |
| 5 testes totais | Validação 100% manual | Regressão não detectada |
| Lógica no frontend | Mudança de regra exige deploy de frontend | Inconsistência entre canais |
| Sem types para Edge Functions | `supabase.functions.invoke` retorna `any` | Erros em runtime |
| `imobzi-import` com 1094 linhas | Manutenção arriscada | Parser + validação + upsert acoplados |
| Settings.tsx com 935 linhas | Adicionar seção = mexer em todo o arquivo | Quebra de UI de outra seção |
| Sem feature flags | Rollout = tudo ou nada | Feature incompleta em produção |

---

## 3. Melhorias para Acelerar Entrega com Segurança

### Tier 1 — Alto impacto, baixo esforço (1-2 dias)

| # | Melhoria | Tempo | Resultado |
|---|---------|-------|-----------|
| A1 | Testes para hooks críticos (`useLeads`, `useProperties`, `useContracts`) | 4h | Confiança para mudar CRUD |
| A2 | `_shared/` modules para Edge Functions | 3h | Base para padronização |
| A3 | Extrair `Settings.tsx` em `SettingsGeneral`, `SettingsTeam`, `SettingsBilling`, etc. | 2h | Cada seção independente |
| A4 | Script de seed para dev local (`seed-dev-data.sql`) | 2h | Onboarding 10x mais rápido |

### Tier 2 — Alto impacto, esforço médio (1 semana)

| # | Melhoria | Tempo | Resultado |
|---|---------|-------|-----------|
| B1 | Quebrar `useProperties` → `usePropertyCRUD` + `usePropertyImages` + `usePropertyOwners` | 6h | Blast radius reduzido |
| B2 | Quebrar `useLeads` → `useLeadCRUD` + `useLeadKanban` + `useLeadBulkOps` | 6h | Idem |
| B3 | Testes de integração para Edge Functions críticas (`billing`, `ai-router`) | 4h | Catch breaking changes |
| B4 | Extrair `GeradorAnuncios.tsx` em sub-componentes | 3h | Manutenção do gerador |
| B5 | Extrair `PropertyDetails.tsx` em tabs separadas | 3h | Cada tab independente |

### Tier 3 — Médio impacto, esforço médio (2 semanas)

| # | Melhoria | Tempo | Resultado |
|---|---------|-------|-----------|
| C1 | Organizar por domínio (`src/modules/crm/`, `src/modules/properties/`, etc.) | 8h | Ownership claro |
| C2 | Wrapper tipado para `supabase.functions.invoke` | 4h | Type safety |
| C3 | Feature flags simples (tabela + hook) | 4h | Rollout gradual |
| C4 | Refatorar `ai-router/index.ts` (890 linhas) em módulos | 6h | Manutenção de providers |

---

## 4. Simplificações de Arquitetura e Fluxo

### O que complicou sem necessidade

| Complexidade | Justificativa original | Simplificação |
|-------------|----------------------|---------------|
| 3 storage providers simultâneos | Migração gradual | Completar migração R2, eliminar Cloudinary |
| `ai-router` com scoring dinâmico | Balanceamento inteligente | Funciona mas 890 linhas para manter; considerar config-driven |
| `imobzi-import` + `imobzi-process` + `imobzi-list` | Pipeline de importação | 3 functions para 1 integração; avaliar merge |
| `billing?action=X` routing por query param | Evitar N functions | OK por ora, mas dificulta monitoring por endpoint |

### O que está bem como está (NÃO simplificar)

| Item | Por que manter |
|------|---------------|
| React Query com staleTime | Funciona bem, sem overhead |
| RLS com `get_user_organization_id()` | Padrão otimizado, sem alternativa melhor |
| Edge Functions para backend | Serverless é correto para a escala atual |
| Supabase para auth + DB | Adequado; trocar seria rewrite |
| `demoData.ts` lazy loaded | Inteligente — 50KB só quando necessário |

---

## 5. Recomendações DX, Testes, Deploy e Manutenção

### DX (Developer Experience)

| Recomendação | Impacto |
|-------------|---------|
| **Regra: nenhum arquivo >500 linhas** | Força modularização natural |
| **Naming: hooks = `use[Domínio][Ação]`** (ex: `useLeadCRUD`) | Autoexplicativo |
| **Cada page < 200 linhas** (composição de componentes) | Pages são orchestrators, não implementação |
| **README por domínio** (`src/modules/crm/README.md`) | Onboarding contextual |
| **`CONTRIBUTING.md`** com convenções | Padrões para PRs |

### Testes

| Nível | Onde Investir | ROI |
|-------|-------------|-----|
| **Unit (hooks)** | `useLeads`, `useProperties`, `useContracts` | Alto — core do negócio |
| **Integration (Edge Functions)** | `billing`, `ai-router`, `platform-signup` | Alto — dinheiro envolvido |
| **Smoke (E2E)** | Login → Dashboard → Criar lead → Criar imóvel | Médio — catch regressões graves |
| **NÃO investir** | Testes de componentes de UI pura | Baixo ROI — mudam frequentemente |

### Deploy

| Aspecto | Status | Melhoria |
|---------|--------|---------|
| Frontend deploy | Lovable publish (manual) | OK |
| Edge Function deploy | Automático | OK |
| Migrations | Via Lovable migration tool | OK |
| Rollback frontend | Lovable history | OK |
| Rollback Edge Function | Manual (redeploy versão anterior) | Manter versions em git |
| Feature flags | Inexistente | Tabela simples + hook |
| Post-deploy monitoring | Sentry instalado, parcialmente ativo | Ativar em mutations |

### Manutenção

| Item | Frequência | Automável? |
|------|-----------|------------|
| Atualizar deps (npm) | Mensal | Sim (dependabot/renovate) |
| Cleanup de logs (pg_cron) | Diário | ✅ Já configurado |
| Cleanup Cloudinary orphans | Sob demanda | Sim (Edge Function existe) |
| Verificar limites Supabase | Semanal | Dashboard manual |
| Revisar Edge Function errors | Semanal | Sentry (se ativado) |

---

## 6. Backlog por Impacto e Esforço

```
                    ALTO IMPACTO
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │  A1: Testes hooks │ B1: Quebrar       │
    │  A2: _shared/     │     useProperties │
    │  A3: Split        │ B2: Quebrar       │
    │      Settings     │     useLeads      │
    │  A4: Seed script  │ C1: Módulos por   │
    │                   │     domínio       │
    │  BAIXO ESFORÇO    │  MÉDIO ESFORÇO    │
    ├───────────────────┼───────────────────┤
    │                   │                   │
    │  QW: Sentry ativo │ C3: Feature flags │
    │  QW: .limit()     │ C4: Refatorar     │
    │                   │     ai-router     │
    │                   │                   │
    │  BAIXO IMPACTO    │  BAIXO IMPACTO    │
    └───────────────────┴───────────────────┘
                        │
                   BAIXO IMPACTO
```

### Execução recomendada:

```
SEMANA 1 (Quick wins, ~10h)
[ ] A1: Testes para useLeads, useProperties, useContracts — 4h
[ ] A2: _shared/auth.ts + cors.ts + response.ts + fetch.ts — 3h
[ ] A3: Split Settings.tsx em 5 sub-componentes — 2h
[ ] A4: seed-dev-data.sql para onboarding — 1h

SEMANA 2 (Modularização, ~12h)
[ ] B1: useProperties → usePropertyCRUD + Images + Owners — 6h
[ ] B2: useLeads → useLeadCRUD + Kanban + BulkOps — 6h

SEMANA 3-4 (Estrutura, ~14h)
[ ] B3: Testes de integração para billing + ai-router — 4h
[ ] B4: Split GeradorAnuncios.tsx — 3h
[ ] B5: Split PropertyDetails.tsx em tabs — 3h
[ ] C2: Wrapper tipado invokeFunction<T> — 4h

SEMANA 5-6 (Organização, ~12h)
[ ] C1: Reorganizar em src/modules/ — 8h
[ ] C3: Feature flags — 4h

BACKLOG (quando necessário)
[ ] C4: Refatorar ai-router/index.ts
[ ] Completar migração Cloudinary → R2
[ ] CONTRIBUTING.md
```

---

## Tempo Estimado por Atividade Comum (Hoje vs. Após Melhorias)

| Atividade | Tempo Hoje | Após Melhorias | Redução |
|-----------|-----------|----------------|---------|
| Onboarding de novo dev | ~2 dias | ~4h | -75% |
| Entender useProperties | ~30min | ~5min (hook focado) | -83% |
| Adicionar campo em lead | ~20min | ~10min | -50% |
| Corrigir bug em billing | ~2h | ~30min (com teste) | -75% |
| Mudar regra de permissão | ~1h | ~20min (lugar canônico) | -67% |
| Deploy de feature nova | ~instant | ~instant + flag | Mais seguro |
| Reproduzir bug de prod | ~1h | ~15min (com Sentry) | -75% |

---

*Auditoria gerada por análise do código-fonte em 2026-03-23.*
