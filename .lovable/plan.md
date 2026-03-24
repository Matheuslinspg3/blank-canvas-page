

# Pagina "Meu Plano" — Consolidacao do Billing no Dashboard

## O que ja existe (nao sera reescrito)

| Componente | Status |
|---|---|
| `useSubscription` hook (status, planos, pagamentos, subscribe/cancel/renew) | Completo |
| `CheckoutDialog` (PIX, Cartao, QR Code) | Completo |
| Edge Function `billing` (Asaas sandbox/production auto-detect) | Completo |
| Edge Function `billing-webhook` (confirmacao, overdue, cancelled) | Completo |
| `/planos` — pagina publica de comparacao | Completo |
| `BillingTab` em Configuracoes — uso atual | Completo |
| Feature gating (`useFeatureGate`, `FeatureFlagGate`) | Completo |
| Real-time listener para ativacao automatica | Completo |

## O que sera criado

### 1. Nova pagina `src/pages/MyPlan.tsx`
Pagina unificada com 4 secoes:

**Secao A — Banner de alerta** (condicional)
- Plano vencido: banner vermelho "Seu plano expirou"
- Menos de 7 dias: banner amarelo "Seu plano vence em X dias"
- Sandbox: banner amarelo "Modo Sandbox — pagamentos simulados"

**Secao B — Status atual do plano**
- Card com: nome do plano, badge de status (verde/amarelo/vermelho), data de vencimento, ciclo de cobranca
- Barras de progresso de uso (imoveis, leads, creditos IA) — reutiliza logica do `BillingTab`
- Botao "Trocar plano" e "Cancelar assinatura"

**Secao C — Planos disponiveis** (cards lado a lado)
- Reutiliza dados de `useSubscription().plans`
- Destaque visual no plano atual
- Botao "Assinar" / "Renovar" / "Upgrade" que abre o `CheckoutDialog` existente
- Toggle mensal/anual

**Secao D — Historico de pagamentos**
- Tabela com dados de `useSubscription().payments`
- Colunas: Data, Valor, Metodo, Status (badge), Link do boleto/invoice

### 2. Menu lateral — renomear item
- Em `AppSidebar.tsx`, alterar o item existente "Planos" (`/planos`) para "Meu Plano" (`/meu-plano`)
- Manter icone `CreditCard`

### 3. Rota
- Adicionar rota `/meu-plano` protegida (dentro do layout autenticado) apontando para `MyPlan`
- Manter `/planos` como rota publica existente (landing)

### 4. Sandbox banner
- Ler `import.meta.env.VITE_ASAAS_MODE` no frontend
- Se `=== 'sandbox'`, exibir banner amarelo no topo da pagina
- A Edge Function `billing` ja detecta sandbox automaticamente via `ASAAS_SANDBOX` env — nenhuma alteracao no backend

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/MyPlan.tsx` | Criar |
| `src/components/AppSidebar.tsx` | Editar (renomear "Planos" → "Meu Plano", rota `/meu-plano`) |
| `src/App.tsx` | Editar (adicionar rota `/meu-plano`) |

Nenhuma alteracao em Edge Functions, webhook, banco de dados ou fluxo de autenticacao.

