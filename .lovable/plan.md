

# Remover Sandbox Asaas — Usar Somente Produção

## Resumo
Remover toda a lógica de sandbox do Asaas do sistema, forçando sempre o uso do ambiente de produção.

## Alterações

### 1. `src/components/billing/CheckoutDialog.tsx`
- Remover prop `defaultSandbox` da interface
- Remover state `useSandbox` e o `useEffect` associado
- Remover a seção "Ambiente de pagamento" (toggle Sandbox/Produção, linhas 346-369)
- Remover `sandbox: useSandbox` do payload de `subscribe.mutate`
- Remover `{useSandbox ? " (Sandbox)" : ""}` do resumo
- Remover imports não utilizados (`Switch`, `FlaskConical`)

### 2. `src/pages/MyPlan.tsx`
- Remover state `checkoutSandbox` e `setCheckoutSandbox`
- Remover prop `defaultSandbox` da chamada do `CheckoutDialog`
- Remover botão "Sandbox" dos cards de plano
- Remover `setCheckoutSandbox(false)` das chamadas de checkout

### 3. `src/hooks/useSubscription.ts`
- Remover parâmetro `sandbox` de `callBilling` e da construção da URL (`sandboxParam`)
- Remover `sandbox` do tipo de params do `subscribe` mutation
- Sempre chamar a edge function sem query param `sandbox` (usará produção por padrão)

### 4. `supabase/functions/billing/index.ts`
- Simplificar `getAsaasConfig`: sempre usar `ASAAS_API_KEY` e `https://api.asaas.com/v3`
- Remover leitura de `ASAAS_SANDBOX`, `ASAAS_SANDBOX_API_KEY`
- Remover parsing do query param `sandbox`
- Remover flag `isSandbox` (sempre false)

### 5. `src/components/settings/PlanCatalogDialog.tsx`
- Sem alterações necessárias (não usa sandbox)

### 6. Componentes de AI Billing (não alterar)
- `BillingSandboxBanner`, `BillingConfigPanel`, `useAiBilling` — referem-se ao sandbox de **AI Token Billing/Stripe**, que é independente do Asaas. Não serão alterados.

## Arquivos modificados
| Arquivo | Ação |
|---|---|
| `src/components/billing/CheckoutDialog.tsx` | Editar |
| `src/pages/MyPlan.tsx` | Editar |
| `src/hooks/useSubscription.ts` | Editar |
| `supabase/functions/billing/index.ts` | Editar |

