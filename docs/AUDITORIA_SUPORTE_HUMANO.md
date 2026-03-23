# Auditoria de Suporte Humano — Porta do Corretor

**Data:** 2026-03-23  
**Foco:** Rastreabilidade, intervenção segura, redução de chamados, velocidade de resolução

---

## 1. MAPA IDEAL DE SUPORTE ASSISTIDO PELO PRODUTO

### Camada 1 — Autoatendimento (N0)
- FAQ contextual por feature (tooltips, links para docs)
- Mensagens de erro acionáveis ("Tente X" em vez de "Erro 500")
- Status page interna com banner de incidentes
- Reprocessamento automático de ações falhas (retry transparente)
- Notificação proativa de falha em massa

### Camada 2 — Suporte N1 (Operador)
- Busca global unificada (email, ID, telefone, tenant)
- Contexto do usuário em uma tela (plano, conta, último erro, ações recentes)
- Trilha de eventos do caso (timeline: request → backend → job → email → erro)
- Ferramentas de intervenção: reenviar email, resetar estado, desbloquear conta
- Copy de IDs com 1 clique
- Runbooks embutidos por ação

### Camada 3 — Suporte N2/Admin (Admin avançado)
- Audit trail completo de ações administrativas
- Correção de estados inconsistentes
- Reprocessamento de webhook/job
- Impersonação segura (visualizar como usuário)
- Dashboard de saúde por módulo

### Camada 4 — Engenharia (Escalonamento)
- Logs correlacionados por request_id
- Payload bruto de integrações
- Métricas de erro por edge function
- Alertas de degradação

---

## 2. GAPS ATUAIS QUE DIFICULTAM ATENDIMENTO

### GAP-S1: Mensagens de erro genéricas e não-rastreáveis
- **Problema:** ~115 arquivos usam `toast.error(e.message)` ou mensagens vagas como "Erro ao salvar". Sem código de erro, sem referência rastreável, sem distinção entre erro temporário/permanente.
- **Impacto no usuário:** Não sabe o que fazer. Abre ticket genérico.
- **Impacto na operação:** Suporte não consegue correlacionar o ticket com o erro real. Precisa pedir screenshot, horário, tentar reproduzir.
- **Causa:** Padrão de catch-all sem enriquecimento de contexto.
- **Solução:** Criar `toastError()` wrapper que: (1) gera erro-ID curto (ex: `ERR-A3F2`), (2) classifica como temporário/permanente, (3) sugere ação ao usuário, (4) envia para Sentry com o ID, (5) permite "Copiar ID do erro" para suporte.
- **Impacto frontend:** Novo utilitário `toastError()` substituindo `toast.error()` progressivamente.
- **Impacto backend:** Zero.
- **Impacto banco:** Zero.
- **Esforço:** Médio
- **Prioridade:** 🔴 Alta

### GAP-S2: Ausência de busca global unificada para suporte
- **Problema:** Não existe tela de "buscar qualquer entidade". Para achar um usuário, o operador precisa navegar para UsersTab; para um lead, para o CRM; para uma cobrança, para billing — cada um com filtros diferentes.
- **Impacto na operação:** Tempo de resolução alto. Operador precisa conhecer múltiplas telas.
- **Causa:** Cada módulo tem busca isolada.
- **Solução:** Criar `AdminGlobalSearch` — command palette (Cmd+K) no painel dev que busca em profiles, leads, properties, contracts, support_tickets, invoices por ID, email, telefone, nome.
- **Impacto frontend:** Novo componente. Usa cmdk (já instalado).
- **Impacto backend:** Edge function `admin-search` com busca federada.
- **Impacto banco:** Índices GIN em email/phone de leads e profiles.
- **Esforço:** Médio
- **Prioridade:** 🔴 Alta

### GAP-S3: Sem visão de contexto do caso no ticket
- **Problema:** `SupportTicketDialog` envia ticket para Supabase externo (`kanrkkvzjbznytensgst`). O operador que recebe no `TicketsTab` vê apenas subject + description. Não tem: plano do usuário, organização, últimas ações, erros recentes, device.
- **Impacto na operação:** Operador precisa perguntar de volta "qual sua organização?", "que página você estava?", etc. Ida e volta que atrasa resolução.
- **Causa:** O dialog não anexa metadados ao ticket.
- **Solução:** Enriquecer o payload do ticket com: `organization_id`, `organization_name`, `user_role`, `current_route`, `user_agent`, `app_version`, `last_errors[]` (últimos 5 erros do Sentry breadcrumb). Exibir esses dados no `TicketsTab` como seção colapsável "Contexto do caso".
- **Impacto frontend:** Alterar `SupportTicketDialog` para incluir metadados. Alterar `TicketsTab` para exibi-los.
- **Impacto backend:** Zero (dados já existem no client).
- **Impacto banco:** Coluna `metadata` (JSON) já existe no schema do ticket externo.
- **Esforço:** Baixo
- **Prioridade:** 🔴 Alta

### GAP-S4: Sem trilha de eventos (timeline) do caso
- **Problema:** Existem `activity_log` e `audit_events` separados, mas nenhuma visão unificada tipo timeline para um usuário específico. Suporte não consegue ver "o que aconteceu antes do erro".
- **Impacto na operação:** Investigação manual. Engenharia é acionada para consultar logs.
- **Causa:** As tabelas existem mas não há UI de consulta por user_id/entity_id unificada.
- **Solução:** Criar `UserTimelineDrawer` — ao clicar em um usuário no `UsersTab`, abre drawer lateral com timeline mesclando `activity_log` + `audit_events` do user, ordenado por timestamp.
- **Impacto frontend:** Novo componente.
- **Impacto backend:** Zero (queries diretas às tabelas existentes).
- **Impacto banco:** Índice em `activity_log(user_id, created_at)` e `audit_events(user_id, created_at)` se não existir.
- **Esforço:** Médio
- **Prioridade:** 🟡 Média

### GAP-S5: Sem ferramentas de intervenção direta
- **Problema:** Se um email não foi enviado, um webhook falhou, ou um import travou, o operador não tem botões para "reenviar", "reprocessar", "cancelar". Precisa acionar engenharia.
- **Impacto no negócio:** Dependência excessiva de devs para operação. Tempo de resolução em horas em vez de minutos.
- **Causa:** Ferramentas de correção não foram construídas.
- **Solução:** Adicionar ações no painel admin:
  - `Import`: Botão "Reprocessar" em imports com status `error`
  - `Push`: Botão "Reenviar" para notificação específica
  - `Email`: Visualizar status de envio e reenviar
  - `Webhooks`: Replay de webhook com payload original
- **Impacto frontend:** Botões de ação em tabs existentes.
- **Impacto backend:** Edge functions de retry/replay.
- **Impacto banco:** Zero (usa tabelas existentes de logs).
- **Esforço:** Alto
- **Prioridade:** 🟡 Média

### GAP-S6: Ausência de comunicação proativa de incidente
- **Problema:** `app_runtime_config` tem `maintenance_mode` mas não há banner de incidente parcial (ex: "importação de fotos lenta hoje"). Ou o sistema inteiro está em manutenção, ou não há comunicação.
- **Impacto no usuário:** Vê erro, não sabe se é dele ou do sistema. Abre ticket.
- **Causa:** Granularidade binária (maintenance on/off).
- **Solução:** Adicionar `incident_message` e `incident_severity` (info/warning/error) ao `app_runtime_config`. Exibir banner contextual no topo do app quando preenchido. Admin pode ativar/desativar pelo painel dev.
- **Impacto frontend:** Componente `IncidentBanner` no layout principal.
- **Impacto backend:** Zero.
- **Impacto banco:** 2 colunas em `app_runtime_config`.
- **Esforço:** Baixo
- **Prioridade:** 🔴 Alta

### GAP-S7: Sem métricas de suporte
- **Problema:** Não existe dashboard de volume de tickets, tempo médio de resposta, taxa de reabertura, motivos mais frequentes.
- **Impacto na operação:** Sem visibilidade de carga, sem priorização baseada em dados.
- **Causa:** Tickets estão em Supabase externo. Sem agregação.
- **Solução:** Adicionar cards de métricas no `TicketsTab`: total abertos, em andamento, resolvidos, tempo médio (se timestamps existem), top categorias.
- **Impacto frontend:** Cards de stats no TicketsTab.
- **Impacto backend:** Zero (queries no Supabase externo).
- **Impacto banco:** Zero.
- **Esforço:** Baixo
- **Prioridade:** 🟡 Média

### GAP-S8: Sem separação clara suporte vs operações vs engenharia
- **Problema:** O painel developer mistura tudo: tickets, roles, database, health, AI config. Não há critérios visíveis de "quando escalar para engenharia".
- **Impacto:** Operadores mexem em configs que não deveriam. Engenheiros são chamados para coisas simples.
- **Causa:** Painel único sem segmentação de responsabilidade.
- **Solução:** (1) Agrupar tabs do Developer Dashboard em seções: "Suporte" (Tickets, Users), "Operações" (Health, Imports, Subscriptions, Cache), "Engenharia" (Database, Migrations, AI Router, Security). (2) Adicionar tooltip "Quando escalar" em cada seção.
- **Impacto frontend:** Reorganização de tabs existentes.
- **Impacto backend:** Zero.
- **Impacto banco:** Zero.
- **Esforço:** Baixo
- **Prioridade:** 🟡 Média

### GAP-S9: ErrorBoundary não reporta ao suporte
- **Problema:** `ErrorBoundary` e `SectionErrorBoundary` mostram UI de fallback mas não oferecem "Reportar este erro" nem enviam contexto para o ticket.
- **Impacto no usuário:** Vê "Algo deu errado" mas não tem ação produtiva além de recarregar.
- **Causa:** Boundaries focadas em recover, não em report.
- **Solução:** Adicionar botão "Reportar erro" no fallback que abre `SupportTicketDialog` pré-preenchido com: mensagem de erro, rota, timestamp, component stack.
- **Impacto frontend:** Alterar `ErrorBoundary` e `SectionErrorBoundary`.
- **Impacto backend:** Zero.
- **Impacto banco:** Zero.
- **Esforço:** Baixo
- **Prioridade:** 🟡 Média

### GAP-S10: Sem base de conhecimento operacional embutida
- **Problema:** Não há tooltips explicando status, significado de erros, ou links para playbooks. Operador precisa decorar significados.
- **Causa:** UX focada em funcionalidade, não em operação.
- **Solução:** Criar componente `OperationalTooltip` que exibe dica contextual (texto curto + link opcional). Usar em: status de contrato, status de import, status de pagamento, status de ticket.
- **Esforço:** Baixo
- **Prioridade:** 🟢 Baixa

---

## 3. MELHORIAS DE RASTREABILIDADE E INTERVENÇÃO

### 3.1 Rastreabilidade
| Recurso | Estado Atual | Melhoria |
|---------|-------------|----------|
| Error ID rastreável | ❌ Não existe | `toastError()` com ID curto |
| Trilha de eventos por user | ❌ Parcial (tabelas existem, UI não) | `UserTimelineDrawer` |
| Metadados no ticket | ❌ Só texto livre | Enriquecer com org, rota, device, erros |
| Correlação request→error | ❌ Logs isolados | request_id no Sentry + audit_events |
| Copy ID | ❌ Não existe no admin | `CopyId` component em todas as tabelas admin |

### 3.2 Intervenção
| Ação | Estado Atual | Melhoria |
|------|-------------|----------|
| Reenviar push | ❌ Não existe | Botão em PushTestCard |
| Reprocessar import | ❌ Manual | Botão "Retry" em ImportHistoryTab |
| Resetar estado de conta | ❌ Não existe | Ação em UsersTab |
| Desbloquear ação travada | ❌ Não existe | Reset de job status |
| Reenviar email | ❌ Não existe | Integrar com email_send_log (quando existir) |

---

## 4. SEPARAÇÃO RECOMENDADA: SUPORTE × OPERAÇÕES × ENGENHARIA

### N1 — Suporte (operador)
- Consultar tickets e responder
- Buscar usuário por email/ID
- Ver contexto da conta (plano, org, últimas ações)
- Ver timeline de eventos do usuário
- Copiar IDs
- Orientar próximo passo

### N2 — Operações (admin)
- Alterar status de ticket
- Reprocessar import falho
- Reenviar notificação push
- Ativar/desativar banner de incidente
- Corrigir estado de cobrança
- Ajustar roles de usuário (dentro da hierarquia)

### N3 — Engenharia
- Acessar Database, Migrations, AI Router
- Replay de webhook com payload
- Correção de estado inconsistente no banco
- Investigação de edge function logs
- Deploy de correções

### Critérios de Escalonamento
| De | Para | Quando |
|----|------|--------|
| N1 → N2 | Operações | Ação requer mudança de estado (reprocessar, desbloquear) |
| N2 → N3 | Engenharia | Erro persiste após retry, estado inconsistente, bug confirmado |
| N1 → N3 | Engenharia | Erro com stack trace que indica bug de código |

---

## 5. MELHORIAS EM MENSAGENS DE ERRO E CONTEXTO

### Padrão Atual (problemático)
```tsx
onError: (e: any) => toast.error(e.message)
// Resultado: "Failed to fetch" — inútil para o usuário e para suporte
```

### Padrão Proposto
```tsx
import { toastError } from "@/lib/toastError";

onError: (e: any) => toastError(e, {
  userMessage: "Não foi possível salvar o lead. Tente novamente.",
  module: "crm",
  action: "lead.create",
  retryable: true,
})
// Resultado: Toast com mensagem clara + botão "Copiar ID do erro" + Sentry enriched
```

### Classificação de Erros
| Tipo | Exemplo | Mensagem para usuário | Ação |
|------|---------|----------------------|------|
| Temporário | Timeout, 503 | "Serviço temporariamente indisponível. Tente em 1 minuto." | Retry automático ou botão |
| Permanente | Validação, 403 | "Você não tem permissão para esta ação." | Orientar contato com admin |
| Desconhecido | Error genérico | "Erro inesperado. Código: ERR-X1Y2. Envie este código ao suporte." | Copy ID |

---

## 6. BACKLOG TÉCNICO E OPERACIONAL PRIORIZADO

### Sprint 1 — Quick Wins (~6h) 🔴
| # | Item | Esforço |
|---|------|---------|
| 1 | **GAP-S3:** Enriquecer ticket com metadados (org, rota, device, erros) | 1h |
| 2 | **GAP-S6:** Banner de incidente (`incident_message` + `IncidentBanner`) | 2h |
| 3 | **GAP-S9:** Botão "Reportar erro" nos ErrorBoundaries | 1h |
| 4 | **GAP-S10:** Tooltips operacionais em status críticos | 2h |

### Sprint 2 — Rastreabilidade (~8h) 🔴
| # | Item | Esforço |
|---|------|---------|
| 5 | **GAP-S1:** Criar `toastError()` com erro-ID, classificação, Sentry | 3h |
| 6 | **GAP-S1b:** Migrar os 20 fluxos mais críticos para `toastError()` | 3h |
| 7 | **GAP-S7:** Cards de métricas de tickets no TicketsTab | 2h |

### Sprint 3 — Busca e Timeline (~10h) 🟡
| # | Item | Esforço |
|---|------|---------|
| 8 | **GAP-S2:** Admin global search (command palette federada) | 5h |
| 9 | **GAP-S4:** UserTimelineDrawer (activity_log + audit_events) | 3h |
| 10 | **GAP-S8:** Reorganizar Developer Dashboard em seções | 2h |

### Sprint 4 — Intervenção (~12h) 🟡
| # | Item | Esforço |
|---|------|---------|
| 11 | **GAP-S5a:** Botão retry em ImportHistoryTab | 3h |
| 12 | **GAP-S5b:** Reenvio de push notification | 2h |
| 13 | **GAP-S5c:** Visualizar/reenviar email (integrar com email_send_log) | 4h |
| 14 | **GAP-S5d:** Replay de webhook com payload | 3h |

---

## 7. PLANO PARA REDUZIR TICKETS E ACELERAR RESOLUÇÃO

### Ações de Redução de Volume
1. **Mensagens de erro acionáveis** → Usuário resolve sozinho → -20% tickets estimado
2. **Banner de incidente** → Usuário sabe que é do sistema → -15% tickets em incidentes
3. **Retry automático em erros temporários** → Erro nunca chega ao usuário → -10% tickets
4. **Tooltips de status** → Operador não precisa perguntar "o que significa X?" → -5% tempo/ticket

### Ações de Aceleração de Resolução
1. **Metadados no ticket** → Elimina ida e volta → -30% tempo por ticket
2. **Busca global** → Encontra caso em segundos → -50% tempo de localização
3. **Timeline do usuário** → Contexto imediato → -40% tempo de investigação
4. **Ferramentas de intervenção** → Resolve sem engenharia → -60% escalonamentos

### Métricas Alvo
| Métrica | Atual (estimado) | Meta |
|---------|-----------------|------|
| Tempo até contexto do caso | 5-10 min | < 30s |
| % tickets que precisam escalar para eng | ~40% | < 15% |
| Tempo de resolução N1 | 30 min | < 10 min |
| Tickets/mês por falta de info na UI | ~30% do total | < 10% |

---

## DIAGNÓSTICO GERAL

O app tem infraestrutura de auditoria sólida (`audit_events`, `activity_log`, Sentry, `useAuditLog`) mas **a camada de consumo dessas informações para suporte é inexistente**. Os dados estão no banco mas não são surfaceados para o operador. O sistema de tickets funciona mas opera sem contexto — é basicamente um formulário de texto livre. Mensagens de erro são genéricas e não-rastreáveis, gerando tickets que poderiam ser evitados.

**Recomendação imediata:** Sprint 1 (GAP-S3 + GAP-S6 + GAP-S9) — ~4h de trabalho, impacto máximo na redução de tickets e velocidade de resolução.
