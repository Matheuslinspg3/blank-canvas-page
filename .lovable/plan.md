

## O chat já está pronto — falta alimentar os dados via N8N

### Estado atual
Toda a infraestrutura frontend + backend + banco está implementada. A tabela `whatsapp_messages` existe mas tem **0 registros**.

### O que precisa ser feito

O workflow do N8N que recebe o webhook `MESSAGES_UPSERT` da Evolution API precisa ser atualizado para **inserir cada mensagem recebida/enviada** na tabela `whatsapp_messages`.

#### Opção A: N8N insere diretamente via Supabase node
No workflow N8N, após receber o evento `MESSAGES_UPSERT`, adicionar um node Supabase que faz INSERT:

```text
Dados a mapear do payload da Evolution API:
- organization_id  → resolver via instance_name (lookup na whatsapp_agent_config)
- instance_name    → body.instance
- remote_jid       → body.data[0].key.remoteJid
- from_me          → body.data[0].key.fromMe
- message_text     → body.data[0].message.conversation ou extendedTextMessage.text
- message_type     → "text" / "image" / etc.
- message_id       → body.data[0].key.id
- timestamp        → converter body.data[0].messageTimestamp (unix) para ISO
```

#### Opção B: Edge Function dedicada para persistir mensagens
Criar uma Edge Function `whatsapp-persist-message` que o N8N chama via HTTP POST, validando com `X-Webhook-Secret`, e que faz o INSERT com service role.

### Recomendação
**Opção B** é mais robusta — centraliza a lógica no backend, valida o payload e evita expor credenciais do Supabase no N8N.

### Implementação (se aprovado)

1. **Nova Edge Function `whatsapp-persist-message`** — recebe payload do N8N, valida secret, resolve org pelo instance_name, insere na tabela
2. **Também inserir a mensagem enviada** — quando o `whatsapp-send` envia com sucesso, inserir o registro na `whatsapp_messages` com `from_me: true`
3. **Configurar o N8N** — adicionar HTTP Request node no workflow do agente para chamar esta Edge Function após cada `MESSAGES_UPSERT`

### Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| **Novo:** `supabase/functions/whatsapp-persist-message/index.ts` | Recebe mensagens do N8N e insere na tabela |
| `supabase/functions/whatsapp-send/index.ts` | Após envio bem-sucedido, inserir registro `from_me: true` na tabela |
| **N8N (manual)** | Adicionar node HTTP POST para `whatsapp-persist-message` no workflow |

