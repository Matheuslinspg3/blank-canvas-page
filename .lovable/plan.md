

# Plano Personalizado ("Monte seu Plano")

## Conceito
Criar um plano do tipo "custom" onde o usuário monta seu próprio plano selecionando módulos/recursos individuais, cada um com um preço unitário. O preço final é a soma dos itens selecionados. O checkout segue o mesmo fluxo Asaas existente.

## Arquitetura

```text
┌─────────────────────────┐
│  plan_modules (nova)    │  ← catálogo de módulos com preço unitário
├─────────────────────────┤
│  id, name, slug, desc   │
│  price_monthly (cents)  │
│  price_yearly (cents)   │
│  feature_key, value     │  ← ex: "max_leads" = 500
│  category, icon         │
│  display_order          │
└─────────────────────────┘

┌──────────────────────────────┐
│  custom_plan_selections      │  ← módulos escolhidos por org
├──────────────────────────────┤
│  id, organization_id         │
│  module_id (FK plan_modules) │
│  created_at                  │
└──────────────────────────────┘
```

## Alterações

### 1. Migration SQL - Novas tabelas

**`plan_modules`** - Catálogo de módulos compráveis:
- Campos: `id`, `name`, `slug`, `description`, `price_monthly` (centavos), `price_yearly` (centavos), `feature_key` (ex: `max_leads`, `whatsapp`, `financial`), `feature_value` (JSONB - número ou boolean), `category` (ex: `gestao`, `marketing`, `ia`, `integracao`), `icon` (string), `display_order`, `is_active`
- RLS: leitura pública para ativos

**`custom_plan_selections`** - Seleções do usuário:
- Campos: `id`, `organization_id` (FK organizations), `module_id` (FK plan_modules), `created_at`
- Unique constraint: `(organization_id, module_id)`
- RLS: leitura/escrita apenas pela própria organização

**Seed de módulos exemplo:**
| Módulo | Preço/mês | feature_key | feature_value |
|---|---|---|---|
| +100 Imóveis | R$19,90 | max_own_properties | 100 |
| +500 Leads | R$29,90 | max_leads | 500 |
| +3 Usuários | R$24,90 | max_users | 3 |
| CRM Kanban | R$39,90 | basic_crm | true |
| Financeiro | R$49,90 | financial | true |
| WhatsApp Connect | R$59,90 | whatsapp | true |
| 50 Artes IA/mês | R$29,90 | ai_art_limit | 50 |
| 100 Textos IA/mês | R$19,90 | ai_text_limit | 100 |
| Meta Ads | R$39,90 | meta_ads | true |
| Contratos IA | R$49,90 | contracts_ai | true |
| Feed XML | R$19,90 | xml_feed | true |
| Suporte Prioritário | R$29,90 | priority_support | true |

### 2. Novo plano "custom" no `subscription_plans`
- Inserir um plano com `slug = 'personalizado'`, `plan_type = 'custom'`, `price_monthly = 0`, `price_yearly = 0` (preço será calculado dinamicamente)

### 3. Edge Function `billing/index.ts` - Nova action `create-custom-subscription`
- Recebe `{ moduleIds: string[], billingCycle, paymentMethod, customerId }`
- Busca módulos selecionados, soma preços
- Salva seleções em `custom_plan_selections`
- Cria cobrança no Asaas com o valor total
- Cria subscription local vinculada ao plano "personalizado"
- Features efetivas = merge de todos os módulos (números somam, booleans = OR)

### 4. Hook `useSubscription.ts` - Suporte ao plano custom
- Nova query `custom-modules` para buscar `plan_modules`
- Nova query para buscar `custom_plan_selections` da org
- Adaptar `getFeatureLimit` e `hasFeature`: se o plano atual é "personalizado", calcular limites a partir dos módulos selecionados (somando quantitativos, OR para booleans)
- Nova mutation `subscribeCustom` que chama a action `create-custom-subscription`

### 5. Novo componente `CustomPlanBuilder.tsx`
- Interface com cards de módulos agrupados por categoria (`Gestão`, `Marketing`, `IA`, `Integrações`)
- Checkboxes para selecionar/deselecionar módulos
- Contador de quantidade para módulos numéricos (ex: "+100 imóveis" x2 = 200 imóveis)
- Resumo lateral com preço total atualizado em tempo real
- Toggle mensal/anual
- Botão "Assinar" que abre o CheckoutDialog com o valor total

### 6. Integração na UI existente
- Adicionar tab "Personalizado" no `PlanCatalogDialog.tsx`
- Adicionar card "Monte seu Plano" na página `/planos` e `/meu-plano`
- Rota `/plano-personalizado` com o builder completo

### 7. Feature gating para plano custom
- Adaptar `useFeatureGate` e `FeatureGate`: quando plano é "personalizado", resolver limites via `custom_plan_selections` + `plan_modules`

## Arquivos modificados/criados
| Arquivo | Ação |
|---|---|
| Migration SQL (2 tabelas + seed) | Criar |
| `src/components/billing/CustomPlanBuilder.tsx` | Criar |
| `src/hooks/useSubscription.ts` | Editar |
| `src/hooks/useFeatureGate.ts` | Editar |
| `src/components/settings/PlanCatalogDialog.tsx` | Editar |
| `src/pages/MyPlan.tsx` | Editar |
| `supabase/functions/billing/index.ts` | Editar |

