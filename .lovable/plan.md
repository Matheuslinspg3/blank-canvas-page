

# Auditoria do Sistema de Pagamentos e Feature Gating

## Resumo da Analise

Analisei todo o fluxo de pagamentos (Edge Functions `billing` e `billing-webhook`), o checkout (`CheckoutDialog`), o controle de acesso (`ProtectedRoute`, `useFreeTrialExpired`), e o feature gating (`useSubscription`). Encontrei **problemas reais** que precisam ser corrigidos.

---

## Problemas Encontrados

### 1. CRITICO: Feature Gating nao esta sendo aplicado

Os helpers `hasFeature()`, `getFeatureLimit()` e `isWithinLimit()` existem no `useSubscription`, mas **quase nenhum componente os usa para bloquear acoes**. Hoje eles aparecem apenas em:
- `BillingTab.tsx` — somente para exibir limites na tela
- `useAutomations.ts` — limita criacao de automacoes

**O que falta**: Nenhum bloqueio real ao criar imoveis, leads, usar IA, contratos, financeiro, etc. Um usuario no plano Gratuito (10 imoveis, 20 leads, 0 creditos IA) pode criar quantos quiser sem restricao.

### 2. CRITICO: Status "pending" conta como ativo

No `useSubscription.ts` linha 225:
```
const isActive = subscription?.status === "active" || 
    subscription?.status === "pending" || ...
```
Isso significa que um usuario que **iniciou o checkout mas nao pagou** (PIX gerado, cartao pendente) ja e tratado como ativo. Deveria ser apenas `active` e `trial`.

### 3. MEDIO: Boleto cria assinatura como "active" sem pagamento

Na Edge Function `billing`, o fluxo de boleto (linha 310) cria a subscription com `status: "active"` imediatamente, antes de qualquer pagamento ser confirmado. Deveria ser `pending`, igual ao PIX e cartao.

### 4. BAIXO: Webhook nao atualiza `current_period_end`

Quando o webhook confirma um pagamento (`PAYMENT_CONFIRMED`), ele muda o status para "active" mas **nao atualiza `current_period_end`**. Em renovacoes futuras, o periodo vai ficar desatualizado.

### 5. OK: Fluxo PIX e Cartao funciona corretamente

- PIX: Gera QR Code → usuario paga → webhook `PAYMENT_CONFIRMED` → atualiza para `active` ✓
- Cartao: Cria assinatura recorrente no Asaas → redireciona para pagamento → webhook confirma ✓
- Real-time: Supabase channel escuta mudancas em `subscriptions` e `billing_payments`, notificando o frontend ✓

### 6. OK: Bloqueio por expiracao funciona

- `useFreeTrialExpired`: Bloqueia usuarios gratuitos apos 15 dias ✓
- `TrialExpiredScreen`: Bloqueia trial expirado ✓
- Bypass para developers/leaders ✓

---

## Plano de Correcao

### Etapa 1: Corrigir status "pending" como ativo
- Em `useSubscription.ts`, remover `"pending"` da checagem `isActive`
- Pending deve ser tratado como "aguardando pagamento", nao como acesso liberado

### Etapa 2: Corrigir boleto para criar como "pending"
- Na Edge Function `billing`, alterar o fluxo de boleto para criar com `status: "pending"` (igual PIX/cartao)

### Etapa 3: Implementar enforcement de feature gating
Adicionar verificacoes reais nos pontos criticos:

| Feature | Onde bloquear | Chave do plano |
|---|---|---|
| Criar imovel | `useProperties` (mutacao de insert) | `max_own_properties` |
| Criar lead | `useLeads` (mutacao de insert) | `max_leads` |
| Usar IA | Hooks de geracao de conteudo | `ai_credits_limit` |
| Contratos | Rota/componente de contratos | `has_contracts` |
| Financeiro | Rota/componente financeiro | `has_financial` |
| WhatsApp | Integracao WhatsApp | `has_whatsapp` |
| Automacoes | Ja implementado ✓ | `automations_limit` |

Criar um hook `useFeatureGate(featureKey)` que retorna `{ allowed, limit, current, upgrade }` e um componente `<FeatureGate>` para wrap de UI.

### Etapa 4: Webhook atualizar periodo
- No `billing-webhook`, ao confirmar pagamento, calcular e atualizar `current_period_end` baseado no `billing_cycle` da subscription.

---

## Detalhes Tecnicos

**Arquivos a modificar:**
1. `src/hooks/useSubscription.ts` — corrigir `isActive`
2. `supabase/functions/billing/index.ts` — corrigir boleto status
3. `supabase/functions/billing-webhook/index.ts` — atualizar `current_period_end`
4. `src/hooks/useFeatureGate.ts` — novo hook de enforcement
5. `src/components/FeatureGate.tsx` — novo componente de bloqueio UI
6. `src/hooks/useProperties.ts` — adicionar verificacao de limite
7. `src/hooks/useLeads.ts` — adicionar verificacao de limite
8. Componentes de IA, contratos, financeiro — adicionar gates

**Nenhuma migracao de banco necessaria** — a estrutura de planos e features ja esta correta no banco.

