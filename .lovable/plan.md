

## Plano: 4 melhorias no Marketplace/WhatsApp/White-Label

### 1. White-Label — Extração de cores da logo (já existe)
A funcionalidade de extrair cores da logo **já está implementada** em `WhiteLabelSettings.tsx` com o botão "Extrair cores da logo" usando `extractColorsFromImage`. Ele extrai até 6 cores e aplica as 3 primeiras automaticamente como primária, secundária e destaque. Nenhuma alteração necessária aqui.

### 2. Tabs de Automações — Scroll horizontal no mobile

**Problema:** O `TabsList` na página Automações (`Automations.tsx`) e no `WhatsAppAgentPanel.tsx` não tem `overflow-x-auto`, então em telas pequenas as abas ficam cortadas.

**Solução:** Adicionar `overflow-x-auto` no `TabsList` de ambos os arquivos para permitir scroll horizontal:
- `src/pages/Automations.tsx` — linha 94: adicionar classes `overflow-x-auto flex-nowrap w-full`
- `src/components/integrations/whatsapp-agent/WhatsAppAgentPanel.tsx` — linha 18: adicionar `overflow-x-auto` e remover `flex-wrap` (que impede o scroll)

### 3. Transferência para Humano — Número de destino e mensagem

**Arquivo:** `src/components/integrations/whatsapp-agent/AgentTransferTab.tsx`

Adicionar campos:
- **Número/contato de transferência** — Input para o número do WhatsApp para onde enviar a conversa (ex: 5521999999999)
- **Mensagem de encaminhamento** — Textarea com a mensagem que a IA envia ao humano junto com o contexto do atendimento (ex: "Olá, um cliente precisa de atendimento humano. Segue o histórico...")

**Banco de dados:** Adicionar colunas `transfer_phone` (text) e `transfer_message` (text) na tabela `whatsapp_agent_config` via migration.

**Hook:** `useWhatsAppAgentConfig.ts` já suporta upsert genérico, basta adicionar os campos ao `AgentConfig` interface.

### 4. Chat WhatsApp no Painel — Nova aba de conversas

Criar uma nova aba "Chat" dentro do `WhatsAppAgentPanel` que exibe as conversas do WhatsApp em tempo real.

**Estrutura:**
- Nova tabela `whatsapp_messages` com: `id`, `organization_id`, `instance_name`, `remote_jid` (número do contato), `from_me` (boolean), `message_text`, `timestamp`, `message_id` (externo)
- Nova aba no `WhatsAppAgentPanel.tsx` com ícone MessageCircle
- Componente `WhatsAppChatPanel.tsx`:
  - Lista de conversas à esquerda (agrupadas por `remote_jid`)
  - Área de chat à direita com histórico de mensagens
  - Layout responsivo (lista em mobile, split em desktop)
- As mensagens são armazenadas pelo webhook do N8N que já recebe os eventos `MESSAGES_UPSERT` — basta gravar na tabela

```text
┌────────────────────────────────────────────┐
│ Conexão │ Comportamento │ ... │ Chat 💬    │
├──────────┬─────────────────────────────────┤
│ Contatos │  João Silva         14:32       │
│ ──────── │  > Olá, tenho interesse no apt  │
│ ● João   │  < Olá João! Qual bairro?       │
│   Maria  │  > Centro, 2 quartos            │
│   Pedro  │                                 │
│          │  [_________________] [Enviar]    │
└──────────┴─────────────────────────────────┘
```

### Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `src/components/ui/tabs.tsx` | Nenhuma (scroll via className) |
| `src/pages/Automations.tsx` | Adicionar `overflow-x-auto` no TabsList |
| `WhatsAppAgentPanel.tsx` | Scroll horizontal + nova aba "Chat" |
| `AgentTransferTab.tsx` | Campos de número e mensagem de transferência |
| `useWhatsAppAgentConfig.ts` | Adicionar `transfer_phone`, `transfer_message` à interface |
| **Nova migration** | Colunas `transfer_phone`, `transfer_message` + tabela `whatsapp_messages` |
| **Novo:** `WhatsAppChatPanel.tsx` | Componente de chat com lista de conversas e mensagens |
| **Novo:** `useWhatsAppChat.ts` | Hook para buscar/enviar mensagens via Supabase realtime |

### Sobre o envio de mensagens

O envio de mensagens do painel será feito via Evolution API (endpoint `sendText`), chamado por uma Edge Function `whatsapp-send-message` que recebe `instance_name`, `remote_jid` e `text`, valida a sessão e encaminha à API.

