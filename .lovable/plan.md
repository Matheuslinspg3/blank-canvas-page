

# Consolidar Edge Function `whatsapp-agent-config` com Créditos e Welcome

## Objetivo
Adicionar ao payload da Edge Function `whatsapp-agent-config` (node IDENTIDADE no n8n) duas informações extras: **saldo de créditos** e **mensagem de boas-vindas selecionada**. Isso elimina 2 chamadas HTTP extras no n8n (`whatsapp-get-welcome` e `whatsapp-deduct-credits` para verificação).

## O que muda

### Edge Function `whatsapp-agent-config/index.ts`
Após montar o payload atual, adicionar duas consultas extras:

1. **Créditos** - Query em `automation_credit_wallets` para retornar:
   - `has_credits: boolean` (balance_brl > 0)
   - `balance_brl: number`
   - `friendly_message` (se sem créditos)

2. **Welcome Message** - Incorporar a lógica do `whatsapp-get-welcome` (filtros por período, audience, campaign, seleção round-robin/A/B, anti-spam via `whatsapp_welcome_log`), retornando:
   - `welcome.message` (texto final)
   - `welcome.media_url`, `welcome.media_type`
   - `welcome.delay_seconds`
   - `welcome.reason` (se nenhuma mensagem selecionada)

O body do request passará a aceitar campos opcionais: `phone`, `contact_name`, `is_lead`, `campaign_tag` para a lógica de welcome.

### Payload de resposta (novo formato)
```text
{
  agent_config: { ... },          // já existe
  ai_config: { ... },             // já existe
  voice_config: { ... },          // já existe
  composed_system_prompt: "...",   // já existe
  properties: { ... },            // já existe
  neighborhoods: { ... },         // já existe

  // NOVO
  credits: {
    has_credits: true,
    balance_brl: 42.50,
    friendly_message: null
  },
  welcome: {
    message: "Olá! Como posso ajudar?",
    message_id: "uuid",
    media_url: null,
    media_type: null,
    delay_seconds: 5,
    reason: null
  }
}
```

### N8N Workflow (ID: HyoHStUv2ZhXnnTG)
Após a consolidação, os nodes `BOAS VINDAS` (whatsapp-get-welcome) e `VERIFICAR CREDITOS` (whatsapp-deduct-credits para check) podem ser removidos. O node IDENTIDADE retorna tudo, e um IF simples checa `credits.has_credits`.

**Nota**: A Edge Function `whatsapp-deduct-credits` continua existindo separadamente para o **débito real** após o processamento de IA. A consolidação aqui é apenas da **verificação de saldo**.

## Arquivos alterados
- `supabase/functions/whatsapp-agent-config/index.ts` - adicionar lógica de créditos + welcome

## Sem migrações necessárias
Todas as tabelas já existem.

