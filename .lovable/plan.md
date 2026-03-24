

# Auditoria Completa: Pagamentos e Feature Gating

## Status Atual

### Fluxo de Pagamento (Asaas)
O fluxo de criacao de assinatura esta **estruturalmente correto**:
- **PIX**: Cria subscription como `pending` → gera QR Code → webhook `PAYMENT_CONFIRMED` → atualiza para `active` com `current_period_end` correto
- **Cartao**: Cria subscription como `pending` → redireciona para invoice Asaas → webhook confirma → `active`
- **Boleto**: Cria como `pending` (corrigido anteriormente) → webhook confirma → `active`
- **Real-time**: Canal Supabase escuta mudancas em `subscriptions` e exibe toast "Assinatura ativada!" quando status muda para `active`

**Nenhum pagamento real foi processado ainda** — nao ha registros em `billing_payments` nem em `billing_webhook_logs`. Todos os usuarios atuais estao em planos `trial` (Starter) ou `active` (Gratuito), criados automaticamente pelo trigger de cadastro.

### isActive Logic (Corrigido)
```
isActive = status === "active" || (status === "trial" && trial_end > now)
```
Isso esta correto. `pending` nao conta como ativo.

---

## PROBLEMA CRITICO: Feature Gating NAO Aplicado

Os hooks `useFeatureGate` e o componente `FeatureGate` **existem no codigo**, mas **nao sao usados em nenhum lugar da aplicacao**. Isso significa:

| Recurso | Limite no Gratuito | Bloqueio Real? |
|---|---|---|
| Criar imovel | 10 | **NAO** — sem verificacao |
| Criar lead | 20 | **NAO** — sem verificacao |
| IA (creditos) | 0 | **NAO** — sem verificacao |
| Contratos | false | **NAO** — sem verificacao |
| Financeiro | false | **NAO** — sem verificacao |
| WhatsApp | false | **NAO** — sem verificacao |
| Automacoes | limitado | Unico com bloqueio ✓ |

Um usuario no plano Gratuito pode criar imoveis, leads e usar recursos ilimitadamente.

---

## Plano de Correcao

### Etapa 1: Enforcement em Criacao de Imoveis
- Em `useProperties.ts`, na mutation de criacao, adicionar verificacao com `useFeatureGate('max_own_properties', totalImoveis)`
- Se `guard()` retornar false, bloquear a insercao e mostrar toast de upgrade

### Etapa 2: Enforcement em Criacao de Leads
- Em `useLeads.ts`, na mutation de criacao, adicionar verificacao com `useFeatureGate('max_leads', totalLeads)`
- Mesmo padrao: toast + bloqueio

### Etapa 3: Gates em Rotas/Componentes
Envolver com `<FeatureFlagGate>` os componentes de:
- Contratos (`has_contracts`)
- Financeiro (`has_financial`)
- WhatsApp (`has_whatsapp`)

### Etapa 4: Gate em chamadas de IA
Nos hooks que chamam Edge Functions de IA, verificar `ai_credits_limit` antes de invocar

---

## Detalhes Tecnicos

**Arquivos a modificar:**
1. `src/hooks/useProperties.ts` — adicionar `useFeatureGate` na mutation `createProperty`
2. `src/hooks/useLeads.ts` — adicionar `useFeatureGate` na mutation `createLead`
3. Componentes de Contratos, Financeiro, WhatsApp — envolver com `<FeatureFlagGate>`
4. Hooks de IA (generate-ad-content, etc.) — verificar `ai_credits_limit` antes da chamada

**O que ja funciona:**
- Webhook ativa subscription corretamente ao confirmar pagamento
- Real-time notifica o frontend da mudanca de status
- `isActive` so retorna true para `active` e `trial` valido
- Boleto cria como `pending` (nao mais como `active`)
- `current_period_end` e atualizado no webhook

