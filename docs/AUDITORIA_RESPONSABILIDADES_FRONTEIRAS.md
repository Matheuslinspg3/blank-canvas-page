# Auditoria de Responsabilidades e Fronteiras — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Mapa de Responsabilidades Ideal

| Camada | Responsabilidade | Não Deve Fazer |
|--------|-----------------|---------------|
| **Frontend** | Renderizar UI, coletar input, validar UX (campo vazio, formato), cache client-side, feedback visual, navegação | Filtrar por permissão, calcular totais financeiros, gerar códigos únicos, decidir regras de negócio |
| **Edge Functions** | Validar integridade de negócio, autorizar ações, orquestrar fluxos, chamar serviços externos, auditar | Formatar textos de UI, decidir navegação, cachear dados de apresentação |
| **Database (RLS + RPCs)** | Garantir integridade referencial, isolamento multi-tenant, unicidade, transações atômicas, constraints | Implementar lógica de negócio complexa, formatar dados para UI |
| **Serviços Externos** | Processar pagamento, enviar email/push, armazenar arquivos, inferência de IA | Decidir regras do nosso domínio |

---

## 2. Responsabilidades Mal Colocadas (Violações Encontradas)

### 🔴 Crítico — Regras de negócio no frontend

| Violação | Arquivo | Linha | O Que Faz | Onde Deveria Estar |
|----------|---------|-------|-----------|-------------------|
| Filtro de leads por broker | `useLeads.ts` | 209-211 | `mapped.filter(l => l.broker_id === user.id)` | RLS policy no banco |
| Geração de código de contrato | `useContracts.ts` | via `generateCode()` | SELECT MAX + increment client-side | RPC com sequence ou `FOR UPDATE` |
| Cálculo de comissões | `useCommissions.ts` | 45-46 | `totalPaid`, `totalPending` via reduce | RPC `compute_commission_summary()` |
| Contagem de contratos por status | `useContracts.ts` | 206-212 | `.filter().length` e `.reduce()` | RPC `compute_contract_stats()` |
| Cálculo financeiro mensal | `useTransactions.ts` | 146+ | `monthlyTransactions.filter().reduce()` | RPC `compute_financial_summary()` |
| Deleção de imóvel (4 DELETEs) | `useProperties.ts` | ~800+ | DELETE sequencial sem transação | RPC `delete_property_cascade()` |

### 🟡 Importante — Autorização parcial no frontend

| Violação | Arquivo | Impacto |
|----------|---------|---------|
| `isBrokerOnly` filtra leads client-side | `useLeads.ts:98,209` | Todos os leads trafegam; corretor filtra localmente |
| `isAdminOrAbove` controla visibilidade de menu | `AppSidebar.tsx:192` | OK para UI, mas API não valida role |
| `isAdmin` bypass de manutenção | `MaintenanceGuard.tsx:42` | Query client-side; pode ser burlado |

### 🟡 Importante — 36 componentes acessando DB diretamente

Componentes fazendo `supabase.from()` ao invés de usar hooks. Isso espalha lógica de acesso a dados na camada de apresentação.

**Exemplos:** `TeamInviteSection.tsx`, `PlatformInviteSection.tsx`, `SyncHistorySection.tsx`, `MaintenanceCard.tsx`, `CloudinaryCleanupSection.tsx`

---

## 3. Fronteiras que Precisam Ser Corrigidas

### Fronteira Frontend ↔ Backend

| Hoje | Correto |
|------|---------|
| Frontend filtra leads por broker | RLS: `broker_id = auth.uid()` para role `corretor` |
| Frontend gera código de contrato | RPC `generate_contract_code(org_id)` |
| Frontend calcula totais financeiros | RPC `compute_financial_summary(org_id, period)` |
| Frontend faz 4 DELETEs para deletar imóvel | RPC `delete_property_cascade(property_id)` |
| 36 componentes fazem `supabase.from()` | Componentes usam hooks; hooks fazem queries |

### Fronteira Backend ↔ Banco

| Hoje | Correto |
|------|---------|
| Edge Functions fazem auth inline (73x) | `_shared/auth.ts` centralizado |
| Sem constraints para plan limits | Trigger `enforce_plan_limits()` no INSERT |
| `app_role` como enum (irreversível) | OK por ora; migrar para tabela quando necessário |

### Fronteira entre Módulos

| Módulo | Fronteira Atual | Problema |
|--------|----------------|---------|
| CRM (leads) | `useLeads.ts` monolítico | Kanban, CRUD, bulk ops, reorder tudo junto |
| Properties | `useProperties.ts` monolítico | CRUD, imagens, owners, import tudo junto |
| Financial | 4 hooks separados sem agregação | Cálculos espalhados em cada hook |
| Billing | 1 Edge Function com `?action=X` | Funciona, mas sem separação clara |
| AI | `ai-router` monolítico (890 linhas) | 10+ providers num arquivo |

---

## 4. Fonte da Verdade por Tipo de Dado

| Dado | Fonte da Verdade | Status |
|------|-----------------|--------|
| Autenticação | Supabase Auth (`auth.users`) | ✅ Correto |
| Permissões | `user_roles` + RLS policies | ⚠️ Frontend filtra adicionalmente |
| Saldo financeiro | Frontend (`reduce` em hooks) | 🔴 Deveria ser RPC |
| Status de pagamento | Asaas (via webhook) | ✅ Correto |
| Leads do corretor | Frontend (`filter`) | 🔴 Deveria ser RLS |
| Código de contrato | Frontend (`MAX + 1`) | 🔴 Deveria ser RPC |
| Plano/assinatura | `subscriptions` + `subscription_plans` | ✅ Correto |
| Limites do plano | `subscription_plans.max_leads` etc. | ⚠️ Sem enforcement |
| Imagens de imóvel | R2 + `property_images` | ✅ Correto |

---

## 5. Proposta de Reorganização

### Por Módulos (src/modules/)

```
src/modules/
├── crm/
│   ├── hooks/
│   │   ├── useLeadCRUD.ts        (~200 linhas)
│   │   ├── useLeadKanban.ts      (~150 linhas)
│   │   ├── useLeadBulkOps.ts     (~100 linhas)
│   │   └── useLeadInteractions.ts (existente)
│   ├── components/
│   │   ├── KanbanBoard.tsx
│   │   ├── LeadForm.tsx
│   │   └── LeadDocumentsTab.tsx
│   └── types.ts
├── properties/
│   ├── hooks/
│   │   ├── usePropertyCRUD.ts    (~250 linhas)
│   │   ├── usePropertyImages.ts  (~200 linhas)
│   │   └── usePropertyOwners.ts  (~150 linhas)
│   ├── components/
│   │   ├── PropertyForm.tsx
│   │   ├── PropertyGallery.tsx
│   │   └── PropertyDetails/
│   └── types.ts
├── financial/
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   ├── useInvoices.ts
│   │   ├── useCommissions.ts
│   │   └── useFinancialSummary.ts (novo, chama RPC)
│   └── components/
├── contracts/
│   ├── hooks/useContracts.ts
│   └── components/
├── billing/
│   ├── hooks/useSubscription.ts
│   └── components/
├── ads/
│   ├── hooks/
│   └── components/
├── settings/
│   ├── components/
│   │   ├── SettingsGeneral.tsx
│   │   ├── SettingsTeam.tsx
│   │   ├── SettingsBilling.tsx
│   │   ├── SettingsBrand.tsx
│   │   └── SettingsIntegrations.tsx
│   └── types.ts
└── admin/
    ├── hooks/
    └── components/
```

### Por Camadas (Edge Functions)

```
supabase/functions/
├── _shared/
│   ├── auth.ts          (requireAuth, requireRole, requireAdmin)
│   ├── cors.ts          (getCorsHeaders com allowlist)
│   ├── response.ts      (ok, error, created envelope)
│   ├── fetch.ts          (fetchWithTimeout)
│   └── validation.ts    (Zod schemas para billing, ai-router)
├── billing/             (manter action routing, mas com shared/)
├── ai-router/           (refatorar em submódulos internos)
└── [outras 70+ functions] (migrar gradualmente para _shared/)
```

---

## 6. Ganhos Esperados

| Área | Ganho | Métrica |
|------|-------|---------|
| **Segurança** | Leads filtrados por RLS, não por frontend | Impossível bypassar via DevTools |
| **Consistência** | Códigos de contrato únicos via sequence | Zero duplicatas |
| **Performance** | Cálculos financeiros em 1 RPC vs. 4 queries + reduce | Dashboard 3-4x mais rápido |
| **Manutenção** | Hooks de 200 linhas vs. 930 linhas | Mudança localizada, sem efeito colateral |
| **Onboarding** | Estrutura por domínio = dev encontra código em 30s | -75% tempo de navegação |
| **Multi-canal** | Lógica no backend = mobile/API reutiliza | Habilita app nativo futuro |
| **Auditoria** | Deleção atômica via RPC | Rastreabilidade completa |

---

## 7. Backlog de Refatoração por Prioridade

```
P0 — REGRAS NO LUGAR ERRADO (Semana 1-2, ~10h)
[ ] Mover filtro broker para RLS policy                    [2h] [Segurança]
[ ] RPC generate_contract_code()                           [1h] [Integridade]
[ ] RPC delete_property_cascade()                          [2h] [Integridade]
[ ] RPC compute_financial_summary()                        [2h] [Performance]
[ ] _shared/auth.ts + cors.ts + response.ts + fetch.ts    [3h] [Padronização]

P1 — MODULARIZAÇÃO DE HOOKS (Semana 3-4, ~12h)
[ ] useProperties → usePropertyCRUD + Images + Owners      [6h]
[ ] useLeads → useLeadCRUD + Kanban + BulkOps              [6h]

P2 — COMPONENTES ACESSANDO DB (Semana 5-6, ~6h)
[ ] Mover 36 supabase.from() de components para hooks      [4h]
[ ] Split Settings.tsx em 5 sub-componentes                 [2h]

P3 — ORGANIZAÇÃO POR DOMÍNIO (Semana 7-8, ~10h)
[ ] Criar src/modules/ structure                            [8h]
[ ] Plan limits enforcement via trigger                     [2h]
```

**Total: ~38h em 8 semanas.** Corrige todas as violações de responsabilidade sem reescrever o sistema.

---

*Auditoria gerada por análise estática do código-fonte em 2026-03-23.*
