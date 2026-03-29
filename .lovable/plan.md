

## Análise do Fluxo de Compra de Planos — Problemas Encontrados

Após revisão completa do código da Edge Function `billing`, `billing-webhook`, `CheckoutDialog`, `useSubscription` e `MyPlan`, e das RLS policies e dados no banco, identifiquei **5 problemas** que podem impedir o fluxo funcionar corretamente ponta a ponta.

---

### Problema 1: `getClaims` pode não existir no Supabase JS v2

A Edge Function `billing/index.ts` (linha 70) usa `anonClient.auth.getClaims(token)`. Este método **não faz parte da API pública estável** do `@supabase/supabase-js@2`. Dependendo da versão exata importada via `esm.sh`, pode falhar com "getClaims is not a function", bloqueando 100% das operações de billing.

**Correção:** Substituir por `supabase.auth.getUser(token)`, que é o método estável e documentado.

---

### Problema 2: Assinatura criada como "pending" nunca ativa sem webhook

Para PIX, a assinatura é criada com `status: "pending"`. A ativação só ocorre quando o webhook `PAYMENT_CONFIRMED` chega. Se o webhook falhar (token errado, função não deployada, erro de lookup), o usuário fica preso em "pending" e o `useSubscription.isActive` retorna `false` — sem acesso às features do plano.

**Correção:** Adicionar na UI um estado de "aguardando pagamento" com polling periódico e botão de "verificar pagamento" que chama a API Asaas para confirmar.

---

### Problema 3: Cancelamento de assinaturas trial/active ao comprar

Nas linhas 185-190 e 258-263, ao criar nova assinatura, o código cancela todas as anteriores com status `active` ou `trial`. Porém, a nova assinatura tem status `pending` (PIX/boleto). Resultado: o usuário perde o plano antigo (trial/gratuito) **antes** do pagamento ser confirmado, ficando sem plano nenhum até o webhook chegar.

**Correção:** Só cancelar assinaturas antigas **no webhook** quando o pagamento for confirmado, não no momento da criação. Ou manter a antiga ativa até a nova ser ativada.

---

### Problema 4: Boleto não retorna `invoiceUrl` ao frontend

O fluxo de boleto (linhas 288-333) cria uma subscription no Asaas mas não busca a URL do boleto (`invoiceUrl`) para o usuário pagar. O frontend só recebe `{ subscription: newSub }` sem nenhum link de pagamento — o usuário não sabe como/onde pagar.

**Correção:** Buscar os payments da subscription Asaas (como feito para credit_card na linha 234) e retornar o `invoiceUrl` e/ou `bankSlipUrl`.

---

### Problema 5: `useSubscription` não reflete o plano novo imediatamente

Após o `subscribe.mutate` no `CheckoutDialog`, a invalidação de queries acontece no `onSuccess` do `useMutation`. Mas o `subscription` query usa `.order("created_at", { ascending: false }).limit(1).maybeSingle()` — se a invalidação e refetch forem rápidos, funciona. Porém, como a nova assinatura tem status `pending`, o `isActive` continua `false` e o plano antigo (que acabou de ser cancelado) não aparece mais. O usuário fica em "limbo".

**Já coberto pelo Problema 3** — a solução é a mesma.

---

### Plano de Implementação

| # | Ação | Arquivo |
|---|------|---------|
| 1 | Substituir `getClaims` por `getUser` na Edge Function billing | `supabase/functions/billing/index.ts` |
| 2 | Mover cancelamento de assinaturas antigas para o webhook (só cancelar quando pagamento confirmado) | `billing/index.ts` + `billing-webhook/index.ts` |
| 3 | Adicionar busca de `invoiceUrl`/`bankSlipUrl` no fluxo boleto | `billing/index.ts` |
| 4 | Adicionar polling/verificação de pagamento na UI para status "pending" | `CheckoutDialog.tsx` ou `MyPlan.tsx` |
| 5 | Garantir que o realtime channel do `useSubscription` está habilitado na página de checkout | `useSubscription.ts` (já existe, só verificar `enabled`) |

### Detalhes Técnicos

**Passo 1 — Fix auth (billing/index.ts):**
```typescript
// Substituir getClaims por getUser
const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
if (authError || !user) throw new Error("Invalid token");
```

**Passo 2 — Cancelamento seguro (billing/index.ts):**
- Remover os blocos `UPDATE subscriptions SET cancelled` dos fluxos PIX/card/boleto
- No `billing-webhook/index.ts`, dentro do handler `PAYMENT_CONFIRMED`, adicionar:
```typescript
// Cancelar assinaturas anteriores da mesma org
await supabase.from("subscriptions")
  .update({ status: "cancelled", cancelled_at: now.toISOString() })
  .eq("organization_id", sub.organization_id)
  .in("status", ["active", "trial"])
  .neq("id", sub.id);
```

**Passo 3 — Boleto invoiceUrl:**
- Após criar a subscription Asaas no fluxo boleto, buscar payments e retornar `invoiceUrl` + `bankSlipUrl`

**Passo 4 — UI polling:**
- Quando `subscription.status === "pending"`, mostrar componente de "aguardando confirmação" com auto-refresh a cada 30s

