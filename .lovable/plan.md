# Plano: Recarga de Créditos via PIX (aprovação manual)

## 1. Correção do erro 401 (whatsapp-agent-config)
Antes de tudo, corrigir o erro atual:
- Garantir que o frontend (`AgentContextPreview.tsx`) envie sempre `Authorization: Bearer <access_token>` explicitamente
- Reforçar na edge function o padrão de 2 clients (userClient com header do usuário + adminClient com service role)
- Logar motivo exato do 401 (token ausente, token inválido, sem organization)

## 2. Banco de Dados
Criar tabela **`credit_recharge_requests`** com:
- `organization_id`, `user_id` (solicitante)
- `amount_brl` (valor que a pessoa diz que pagou)
- `pix_key` (fixo: 13996666432)
- `receipt_url` (comprovante enviado, opcional — só email basta inicialmente)
- `status`: `pending` | `approved` | `rejected`
- `approved_by`, `approved_at`, `rejection_reason`
- `credits_granted` (quanto foi liberado em BRL após aprovação)

RLS:
- Usuário vê/cria apenas suas próprias solicitações da sua org
- Developers veem todas

Trigger: ao mudar status para `approved`, somar `credits_granted` no saldo da organização (tabela de créditos existente — `automation_credits` ou equivalente).

## 3. Fluxo do Usuário (Recarga)
Página/modal **"Recarregar Créditos"**:
1. Mostra QR Code PIX gerado a partir da chave `13996666432`
2. Mostra a chave copiável
3. Usuário informa o valor que vai pagar
4. Botão "Já paguei" → cria registro `pending` em `credit_recharge_requests`
5. Edge function `notify-recharge-request` envia email para o developer com:
   - Nome do usuário, organização, valor, data
   - Link direto para o painel de aprovação

## 4. Painel do Developer
Nova rota `/developer/recargas` (apenas role `developer`):
- Lista de solicitações `pending` em destaque
- Histórico de aprovadas/rejeitadas
- Para cada pendente: botões **Aprovar** (com input de valor real em créditos) e **Rejeitar** (com motivo)
- Ao aprovar: chama edge function que atualiza status e credita o saldo

## 5. Email (notificação)
Usar **Lovable Emails** (built-in):
- Setup do domínio de email (se ainda não configurado)
- Template transacional `recharge-request-received` enviado para email do developer
- Conteúdo: dados da solicitação + link para o painel

## 6. Arquivos a criar/editar
**Criar:**
- `supabase/migrations/...` — tabela `credit_recharge_requests` + RLS + trigger de crédito
- `supabase/functions/notify-recharge-request/index.ts`
- `supabase/functions/approve-recharge-request/index.ts`
- `src/pages/RechargeCredits.tsx` (usuário)
- `src/pages/developer/RechargeApprovals.tsx` (developer)
- `src/components/credits/PixQRCode.tsx`
- Template email transacional

**Editar:**
- `supabase/functions/whatsapp-agent-config/index.ts` — fix 401
- `src/components/automations/AgentContextPreview.tsx` — header Authorization explícito
- `src/components/AppSidebar.tsx` — link "Recargas" (developers) e botão "Recarregar" (usuários)
- Rotas no `App.tsx`

## Perguntas antes de implementar
1. **Email do developer** para receber as notificações?
2. **Conversão valor pago → créditos**: 1 BRL pago = 1 BRL de crédito? Ou aplicar bônus/markup?
3. **QR Code PIX**: gerar dinâmico com valor (PIX copia-e-cola BR Code) ou apenas QR estático da chave?
4. **Comprovante**: precisa upload da imagem no sistema ou basta a pessoa enviar pelo email/whatsapp manualmente?
