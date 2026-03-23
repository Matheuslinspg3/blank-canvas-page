# Auditoria da Camada Administrativa e Operacional

**Data:** 2026-03-23  
**Escopo:** Pilares 1–15 da solicitação de camada admin/ops

---

## 1. MAPA DA CAMADA ADMINISTRATIVA ATUAL

### Superfícies administrativas existentes

| Superfície | Acesso | Funcionalidades |
|-----------|--------|-----------------|
| **DeveloperDashboard** (`/developer`) | `developer` role | 13 tabs: Uso por Org, Storage, Banco, Importações, Roles, Usuários, Assinaturas, Tickets, IA, AI Router, Billing IA, Migração, Setup |
| **AdminAudit** (`/admin/auditoria`) | `admin_allowlist` | Métricas globais (counts de entidades), organizações, tabelas top-10 |
| **Administration** (`/administracao`) | `admin`+ | Equipe, convites, roles customizados, histórico de membros, leads não atribuídos, atividades |
| **Maintenance** (`/manutencao`) | `developer` (parcial) | Export de dados, toggle manutenção, SQL generation |
| **Settings** (`/configuracoes`) | `authenticated` | Perfil, org, notificações, integrações, tickets do usuário |

### Componentes developer existentes (26 arquivos)
- SystemHealthCard (counts básicos)
- UsersTab (busca, roles, reset senha, delete)
- RolesTab, SubscriptionsTab, TicketsTab
- DatabaseTab (counts por tabela)
- MigrationTab (batch operations)
- AIProviderCard, AIUsageDashboard, AILogsTable, AiRouterTab
- SecurityAuditCard, BillingDashboardTab
- SendPushCard, PurgeCacheCard, PwaDiagnosticsCard, MaintenanceCard
- SetupChecklistTab, ImportHistoryTab, OrgUsageTab, StorageUsageTab

---

## 2. GAPS DO PAINEL ADMIN ATUAL

### GAP-1: Sem busca unificada de entidades
- **Situação:** Cada tab tem busca isolada. Não há busca global por ID, email, telefone ou nome que cruze usuários, leads, imóveis e contratos.
- **Impacto:** Operador precisa navegar 4-5 tabs para localizar um caso. Tempo de resolução de suporte 3-5x maior.
- **Causa:** Tabs foram criadas individualmente sem visão de fluxo operacional.
- **Solução:** Componente `AdminGlobalSearch` com busca cross-entity via edge function dedicada.
- **Frontend:** Novo componente no DeveloperDashboard.
- **Backend:** Edge function `admin-search` que consulta múltiplas tabelas.
- **Banco:** Nenhum (leitura via service_role).
- **Arquitetura:** Pattern de busca federada.
- **Esforço:** Médio | **Prioridade:** Alta

### GAP-2: Sem log viewer de audit_events na UI
- **Situação:** `audit_events` existe no banco mas só é consultado em `Activities.tsx` (por org). Developer não consegue ver audit trail global.
- **Impacto:** Investigação de incidentes requer acesso direto ao SQL Editor do Supabase.
- **Causa:** Activities foi construída para o admin da org, não para o developer/ops.
- **Solução:** Tab "Auditoria" no DeveloperDashboard com filtros por entidade, ação, usuário, data.
- **Frontend:** Novo componente `AuditEventsTab`.
- **Backend:** Nenhum (RLS + developer role).
- **Banco:** Nenhum.
- **Arquitetura:** Read-only, sem risco.
- **Esforço:** Médio | **Prioridade:** Alta

### GAP-3: Ações admin sensíveis sem confirmação dupla nem audit trail
- **Situação:** `UsersTab` permite deletar usuário e resetar senha com apenas um AlertDialog simples. Não registra em `audit_events`.
- **Impacto:** Ação destrutiva sem rastreabilidade. Em caso de incidente, não se sabe quem deletou quem.
- **Causa:** CRUD implementado sem camada de auditoria.
- **Solução:** Wrapper `auditedAction()` que registra em `audit_events` antes/depois de mutations sensíveis.
- **Frontend:** Util + integração em mutations de delete/reset/role change.
- **Backend:** Nenhum (insert direto via client com service role ou RLS).
- **Banco:** Nenhum (tabela `audit_events` já existe).
- **Arquitetura:** Pattern de audit decorator em mutations.
- **Esforço:** Médio | **Prioridade:** Alta

### GAP-4: SystemHealthCard mostra apenas counts, sem saúde real
- **Situação:** Mostra contagem de entidades. Não mostra: erros recentes, Edge Functions com falha, latência, jobs atrasados, tickets pendentes.
- **Impacto:** Operador não tem visibilidade de problemas até receber reclamação.
- **Causa:** Card foi criado como overview, não como health check.
- **Solução:** Adicionar: contagem de erros em `ai_router_logs` (últimas 24h), tickets abertos, Edge Function errors, status de integrações.
- **Frontend:** Expandir SystemHealthCard com seção de alertas.
- **Backend:** Nenhum.
- **Banco:** Queries em tabelas existentes.
- **Arquitetura:** Sem impacto.
- **Esforço:** Baixo | **Prioridade:** Média

### GAP-5: Sem ferramentas de correção operacional
- **Situação:** Não existe UI para: reprocessar webhook, reenviar notificação, regenerar documento, corrigir estado inconsistente. Tudo requer SQL manual ou MigrationTab (genérica).
- **Impacto:** Dependência de engenharia para qualquer correção operacional.
- **Causa:** Correções foram tratadas como one-offs na MigrationTab.
- **Solução:** Seção "Ações Operacionais" com botões contextuais: reenviar push, reprocessar import, limpar cache de org.
- **Frontend:** Componente `OperationalActionsCard`.
- **Backend:** Edge functions dedicadas ou reutilização das existentes.
- **Banco:** Nenhum.
- **Arquitetura:** Pattern de ações idempotentes com confirmação.
- **Esforço:** Alto | **Prioridade:** Média

### GAP-6: Sem visibilidade de estados internos de processamento
- **Situação:** Import de leads, sync RD Station, upload R2 — não há painel mostrando status em tempo real. Operador não sabe se job está rodando, falhou ou finalizou.
- **Impacto:** Suporte não consegue informar usuário sobre status de importação.
- **Causa:** Logs ficam apenas no Supabase Edge Function logs (dashboard externo).
- **Solução:** Tabela `job_status` ou consulta a `crm_import_logs` / `import_runs` com status visual.
- **Frontend:** Card de jobs recentes com status badges.
- **Backend:** Nenhum (dados já existem em tabelas).
- **Banco:** Nenhum.
- **Arquitetura:** Read-only.
- **Esforço:** Baixo | **Prioridade:** Média

### GAP-7: Sem segregação de acesso admin por tenant
- **Situação:** DeveloperDashboard vê TODOS os dados de TODAS as orgs. Não há modo "admin por tenant" para quando um líder de organização precisa de painel operacional.
- **Impacto:** Se expandir para multi-org, cada org admin precisará de visibilidade parcial. Hoje, `Administration.tsx` é escopo por org mas muito limitado.
- **Causa:** Dashboard construído para single-tenant operacional (Porto Caiçara).
- **Solução:** Adicionar filtro de organização no DeveloperDashboard (para developers) e expandir Administration (para admins de org).
- **Frontend:** Dropdown de org no header do developer dashboard.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Preparação multi-tenant.
- **Esforço:** Médio | **Prioridade:** Baixa

### GAP-8: Sem runbooks nem dicas contextuais
- **Situação:** Botões como "Deletar Usuário", "Resetar Senha", "Purgar Cache" não têm tooltip explicando consequências.
- **Impacto:** Operador novo pode executar ação destrutiva por engano.
- **Causa:** UI focada em funcionalidade, não em orientação.
- **Solução:** Tooltips com descrição + consequência + reversibilidade em todas as ações sensíveis.
- **Frontend:** Tooltips em botões críticos.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** UX operacional.
- **Esforço:** Baixo | **Prioridade:** Média

### GAP-9: Sem copiar IDs rapidamente
- **Situação:** Tabelas de usuários, leads, imóveis não têm botão "copiar ID". Operador precisa selecionar texto manualmente.
- **Impacto:** Fricção desnecessária em investigações. IDs são UUIDs longos.
- **Causa:** Feature não priorizada.
- **Solução:** Botão copy-to-clipboard inline em todas as tabelas admin.
- **Frontend:** Micro-componente `CopyId`.
- **Backend:** Nenhum.
- **Banco:** Nenhum.
- **Arquitetura:** Nenhum.
- **Esforço:** Baixo | **Prioridade:** Alta

### GAP-10: Sem monitoramento de integrações externas
- **Situação:** Status de OneSignal, Cloudflare R2, Cloudinary, Resend, RD Station, Meta Ads, Asaas/Imobzi — nenhum é monitorado na UI. Falha só é percebida quando usuário reclama.
- **Impacto:** Downtime silencioso de integrações críticas.
- **Causa:** Integrações foram conectadas sem health check.
- **Solução:** Card "Status de Integrações" que tenta ping/health em cada serviço.
- **Frontend:** `IntegrationHealthCard` no developer dashboard.
- **Backend:** Edge function `health-check-integrations` com timeout curto.
- **Banco:** Nenhum.
- **Arquitetura:** Pattern de health check com circuit breaker.
- **Esforço:** Alto | **Prioridade:** Média

---

## 3. RISCOS OPERACIONAIS E DE SEGURANÇA

| # | Risco | Severidade | Probabilidade |
|---|-------|-----------|---------------|
| R1 | Delete de usuário sem audit trail → sem forensics em incidente | Alta | Média |
| R2 | Reset de senha sem log → acesso indevido não rastreável | Alta | Baixa |
| R3 | Falha em integração externa invisível → degradação silenciosa | Média | Alta |
| R4 | Operador executa ação destrutiva por falta de runbook | Média | Média |
| R5 | Investigação lenta por falta de busca global | Média | Alta |
| R6 | SystemHealthCard não detecta problemas reais | Média | Alta |

---

## 4. PROPOSTA DE ESTRUTURA DO ADMIN POR MÓDULOS

```
DeveloperDashboard (role: developer)
├── Visão Geral
│   ├── SystemHealthCard (expandido com alertas)
│   ├── IntegrationHealthCard
│   └── RecentJobsCard
├── Busca Global (AdminGlobalSearch)
├── Usuários & Roles
│   ├── UsersTab (com CopyId + audit)
│   └── RolesTab
├── Dados
│   ├── DatabaseTab
│   ├── OrgUsageTab
│   └── StorageUsageTab
├── Operações
│   ├── ImportHistoryTab
│   ├── MigrationTab
│   └── OperationalActionsCard
├── Inteligência Artificial
│   ├── AIProviderCard
│   ├── AIUsageDashboard / AILogsTable
│   ├── AiRouterTab
│   └── BillingDashboardTab
├── Suporte
│   ├── TicketsTab
│   └── AuditEventsTab (NOVO)
├── Configuração
│   ├── SetupChecklistTab
│   ├── SecurityAuditCard
│   └── SubscriptionsTab
└── Infraestrutura
    ├── SendPushCard / PurgeCacheCard
    ├── PwaDiagnosticsCard
    └── MaintenanceCard

Administration (role: admin)
├── Equipe & Convites
├── Roles por módulo
├── Leads não atribuídos
├── Histórico de membros
└── Atividades da organização
```

---

## 5. BACKLOG TÉCNICO PRIORIZADO

### Sprint 1 — Quick Wins (~6h)
| # | Item | Esforço | Risco |
|---|------|---------|-------|
| 1.1 | `CopyId` micro-componente + integrar em UsersTab, DatabaseTab | Baixo | Zero |
| 1.2 | Tooltips/runbooks em ações sensíveis (delete, reset, purge) | Baixo | Zero |
| 1.3 | Expandir SystemHealthCard com erros de IA (últimas 24h) + tickets abertos | Baixo | Zero |
| 1.4 | Card de jobs recentes (import_runs, crm_import_logs) | Baixo | Zero |

### Sprint 2 — Auditoria e Rastreabilidade (~10h)
| # | Item | Esforço | Risco |
|---|------|---------|-------|
| 2.1 | Util `auditedAction()` que registra em `audit_events` | Médio | Baixo |
| 2.2 | Integrar audit em: delete user, reset password, change role | Médio | Baixo |
| 2.3 | Nova tab `AuditEventsTab` no developer dashboard | Médio | Zero |
| 2.4 | Filtros: entidade, ação, user, data range | Médio | Zero |

### Sprint 3 — Busca e Correção (~12h)
| # | Item | Esforço | Risco |
|---|------|---------|-------|
| 3.1 | Edge function `admin-search` (cross-entity) | Alto | Baixo |
| 3.2 | Componente `AdminGlobalSearch` no dashboard | Médio | Zero |
| 3.3 | `OperationalActionsCard` (reenviar push, limpar cache org) | Médio | Baixo |
| 3.4 | `IntegrationHealthCard` com ping de serviços | Alto | Baixo |

### Sprint 4 — Multi-tenant prep (~6h)
| # | Item | Esforço | Risco |
|---|------|---------|-------|
| 4.1 | Dropdown de organização no developer dashboard | Médio | Baixo |
| 4.2 | Filtrar dados por org selecionada | Médio | Baixo |

---

## 6. PLANO DE EVOLUÇÃO

| Fase | Objetivo | Prazo |
|------|----------|-------|
| 1. Rastreabilidade | Audit trail em todas as ações admin + log viewer | 2 sprints |
| 2. Eficiência | Busca global + copy IDs + runbooks | 1 sprint |
| 3. Observabilidade | Health de integrações + jobs + erros | 2 sprints |
| 4. Escalabilidade | Multi-tenant admin + segregação de acesso | 1 sprint |
