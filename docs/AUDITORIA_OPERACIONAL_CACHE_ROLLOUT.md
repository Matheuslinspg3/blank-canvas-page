# Auditoria Operacional: Admin, Suporte, Feature Flags, Migração de Versões e Cache

**Data:** 2026-03-23  
**Escopo:** Pilares 16–20 do plano de melhorias

---

## 1. DIAGNÓSTICO GERAL

### Estado atual por pilar

| Pilar | Maturidade | Observação |
|-------|-----------|------------|
| 16. Admin/Ops | Média | `Maintenance.tsx` robusto, mas sem health dashboard, sem métricas de uso, sem log viewer |
| 17. Suporte | Baixa-Média | Tickets via Supabase externo + n8n. Sem SLA tracking, sem prioridade automática, sem status sync |
| 18. Feature Flags | Inexistente | Zero infraestrutura. `hasFeature()` do `useSubscription` é gating por plano, não rollout |
| 19. Migração de versões | Média | `APP_VERSION`, `version.json`, UpdateBanner, SW update routine. Sem changelog, sem rollback |
| 20. Cache | Alta | PWA Workbox bem configurado, React Query com staleTime/gcTime. Sem invalidação coordenada |

---

## 2. PROBLEMAS IDENTIFICADOS

### P1 — Sem feature flags para rollout controlado
- **Impacto:** Qualquer deploy afeta 100% dos usuários simultaneamente. Impossível testar features com grupo beta ou reverter sem redeploy.
- **Causa:** Não existe tabela nem hook de feature flags no sistema.
- **Solução:** Criar tabela `feature_flags` + hook `useFeatureFlag()` que consulta flags por organização/usuário.
- **Como implementar:** Migration para tabela + hook React + componente `<FeatureGate>`.
- **Frontend:** Novo hook `useFeatureFlag`, componente wrapper `<FeatureGate>`.
- **Backend:** Tabela `feature_flags` com RLS.
- **Banco:** Nova tabela + RLS policies.
- **Arquitetura:** Pattern novo que permite rollout gradual.
- **Esforço:** Médio
- **Prioridade:** Alta

### P2 — Changelog invisível para usuários
- **Impacto:** Usuário não sabe o que mudou entre versões. Suporte recebe perguntas sobre features novas. Sem rastreabilidade de releases.
- **Causa:** `APP_VERSION` existe mas só mostra número no rodapé. Sem histórico ou notificação de novidades.
- **Solução:** Criar componente `WhatsNewDialog` que mostra changelog ao detectar versão nova.
- **Como implementar:** Arquivo `changelog.ts` com entries + dialog auto-open quando versão muda.
- **Frontend:** Novo componente + armazenamento de última versão vista no localStorage.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Padrão leve, sem dependências novas.
- **Esforço:** Baixo
- **Prioridade:** Média

### P3 — Cache do PWA pode servir dados stale após deploy crítico
- **Impacto:** Após deploy com breaking changes, usuários com SW ativo podem usar versão antiga do app por horas/dias se não interagirem com o UpdateBanner.
- **Causa:** `skipWaiting: false` (correto para estabilidade) + `networkTimeoutSeconds: 5` no cache de API = fallback para cache stale.
- **Solução:** Adicionar mecanismo de "force update" via `app_runtime_config` — quando admin publica versão crítica, todos os clientes recebem ordem de refresh via realtime.
- **Como implementar:** Coluna `force_update_version` em `app_runtime_config` + lógica no `MaintenanceGuard` que compara com `APP_VERSION`.
- **Frontend:** Lógica no guard + reload automático.
- **Backend:** Coluna na tabela existente.
- **Banco:** ALTER TABLE.
- **Arquitetura:** Extensão do padrão já existente de realtime config.
- **Esforço:** Médio
- **Prioridade:** Alta

### P4 — Suporte sem SLA tracking nem prioridade automática
- **Impacto:** Tickets ficam sem resposta sem visibilidade. Equipe não sabe quais são urgentes. Não há métricas de tempo de resposta.
- **Causa:** Tickets vão para Supabase externo + webhook n8n sem metadata de SLA.
- **Solução:** Adicionar campos `priority`, `first_response_at`, `resolved_at` na tabela de tickets do Supabase externo + exibir no painel do developer.
- **Como implementar:** Depende de acesso ao projeto Supabase externo (`kanrkkvzjbznytensgst`). Pode-se adicionar metadata no payload enviado ao n8n.
- **Frontend:** Badge de prioridade no `UserTicketsSection`, indicadores no developer dashboard.
- **Backend:** Enriquecer payload do webhook.
- **Banco:** Alteração no projeto externo (fora do escopo direto).
- **Arquitetura:** Melhoria incremental no fluxo existente.
- **Esforço:** Médio
- **Prioridade:** Média

### P5 — Admin não tem dashboard de saúde do sistema
- **Impacto:** Operador não sabe se Supabase está lento, se há erros em Edge Functions, ou se há pico de uso. Problemas só são descobertos por reclamação de usuário.
- **Causa:** `Maintenance.tsx` foca em manutenção/migration, não em observabilidade.
- **Solução:** Card de health check no developer dashboard: status do banco, contagem de erros recentes em `ai_router_logs`, tickets abertos, sessões ativas.
- **Como implementar:** Componente `SystemHealthCard` que consulta counts de tabelas existentes.
- **Frontend:** Novo componente no DeveloperDashboard.
- **Backend:** Nenhum (usa dados existentes via RLS).
- **Banco:** Nenhum.
- **Arquitetura:** Componente read-only, sem risco.
- **Esforço:** Baixo
- **Prioridade:** Média

### P6 — Invalidação de cache React Query inconsistente entre módulos
- **Impacto:** Após criar lead, imóvel ou contrato, outros módulos (dashboard KPIs, ranking) podem mostrar dados stale por até 5 minutos.
- **Causa:** Cada mutation invalida apenas sua own queryKey. Não há invalidação cross-module (ex: criar lead → invalidar dashboard KPIs).
- **Solução:** Criar util `invalidateRelated()` que mapeia entidades para queryKeys dependentes.
- **Como implementar:** Mapa de dependências + wrapper em mutations críticas.
- **Frontend:** Util + ajuste em mutations existentes.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Pattern de invalidação coordenada.
- **Esforço:** Médio
- **Prioridade:** Média

### P7 — Sem rollback de versão frontend
- **Impacto:** Se um deploy introduz bug, a única opção é fazer hotfix e novo deploy. Não há como reverter rapidamente.
- **Causa:** Build output é sempre "latest". Não há mecanismo de "apontar para build anterior".
- **Solução:** Isso é gerenciado pelo Lovable/Git. Documentar processo de rollback via revert de commit + publish. Adicionar `version.json` build-time para tracking.
- **Como implementar:** Script de build que gera `version.json` automático + documentação de processo.
- **Frontend:** Script no build pipeline.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Processo, não código.
- **Esforço:** Baixo
- **Prioridade:** Baixa

### P8 — staleTime inconsistente e sem política documentada
- **Impacto:** Alguns hooks usam 15s, outros 30min. Sem lógica clara de por que cada valor foi escolhido. Dificulta manutenção e pode causar uso excessivo de bandwidth ou dados stale.
- **Causa:** Cada hook definiu staleTime ad-hoc conforme necessidade imediata.
- **Solução:** Criar constantes de cache tiers + documentar política.
- **Como implementar:** Arquivo `src/config/cachePolicy.ts` com tiers nomeados.
- **Frontend:** Constantes importadas nos hooks.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Padronização, manutenibilidade.
- **Esforço:** Baixo
- **Prioridade:** Média

---

## 3. RISCOS OPERACIONAIS E TÉCNICOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Deploy com bug afeta 100% dos usuários | Alta | Alto | Feature flags (P1) |
| Usuário usa versão antiga após deploy crítico | Média | Alto | Force update (P3) |
| Ticket de suporte sem resposta por dias | Alta | Médio | SLA tracking (P4) |
| Dashboard não reflete dados recém-criados | Alta | Baixo | Invalidação coordenada (P6) |
| staleTime curto demais causa overhead | Baixa | Baixo | Política de cache (P8) |

---

## 4. MELHORIAS PRIORIZADAS

| # | Melhoria | Esforço | Prioridade | Dependência |
|---|----------|---------|------------|-------------|
| 1 | Política de cache padronizada (P8) | Baixo | Alta | Nenhuma |
| 2 | Feature flags (P1) | Médio | Alta | Migration |
| 3 | Force update via realtime (P3) | Médio | Alta | P8 opcional |
| 4 | Changelog / What's New (P2) | Baixo | Média | Nenhuma |
| 5 | Health dashboard (P5) | Baixo | Média | Nenhuma |
| 6 | Invalidação cross-module (P6) | Médio | Média | P8 |
| 7 | SLA tracking suporte (P4) | Médio | Média | Acesso a projeto externo |
| 8 | Documentar rollback (P7) | Baixo | Baixa | Nenhuma |

---

## 5. PLANO DE EXECUÇÃO

### Fase 1 — Fundação operacional (Quick wins, ~6h)
- **P8:** Criar `cachePolicy.ts` com tiers padronizados e migrar hooks principais
- **P2:** Criar `WhatsNewDialog` com changelog estruturado
- **P5:** Card de health no developer dashboard

### Fase 2 — Controle de rollout e deploy (~10h)
- **P1:** Tabela `feature_flags` + hook `useFeatureFlag` + componente `<FeatureGate>`
- **P3:** Force update via `app_runtime_config.force_update_version`
- **P6:** Util `invalidateRelated()` + integrar em mutations críticas

### Fase 3 — Maturidade operacional (~8h)
- **P4:** Enriquecer payload de tickets com prioridade + SLA fields
- **P7:** Documentar e testar processo de rollback

---

## 6. BACKLOG TÉCNICO EXECUTÁVEL

### Sprint 1 — Cache e Observabilidade
```
[ ] 1.1 Criar src/config/cachePolicy.ts com CACHE_TIERS
[ ] 1.2 Migrar top-10 hooks para usar CACHE_TIERS
[ ] 1.3 Criar SystemHealthCard no developer dashboard
[ ] 1.4 Criar WhatsNewDialog + changelog.ts
```

### Sprint 2 — Feature Flags
```
[ ] 2.1 Migration: tabela feature_flags + RLS
[ ] 2.2 Hook useFeatureFlag()
[ ] 2.3 Componente <FeatureGate>
[ ] 2.4 UI de gerenciamento no developer dashboard
```

### Sprint 3 — Deploy Seguro
```
[ ] 3.1 Migration: coluna force_update_version em app_runtime_config
[ ] 3.2 Lógica de force update no MaintenanceGuard
[ ] 3.3 Util invalidateRelated() para cache cross-module
[ ] 3.4 Integrar invalidação em mutations de leads, properties, contracts
```

### Sprint 4 — Suporte e Processo
```
[ ] 4.1 Enriquecer webhook de ticket com priority + metadata
[ ] 4.2 Badge de prioridade no UserTicketsSection
[ ] 4.3 Documentar processo de rollback
```
