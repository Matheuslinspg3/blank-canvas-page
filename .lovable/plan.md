

# Plano: Custos por Mensagem, Lead Inteligente e Controle de Acesso no Chat WhatsApp

## Resumo

Quatro mudanças no painel de chat WhatsApp:
1. Exibir custo por mensagem (da coluna `estimated_cost_usd` em `whatsapp_messages`) e custo total por chat — visível apenas para admin/sub_admin
2. Botão "Cadastrar Lead" verifica se o lead já existe e mostra "Lead Cadastrado" quando já existir
3. Abas de configuração do agente IA (Comportamento, Imóveis, Qualificação, Transferência, Voz) visíveis apenas para admin/sub_admin
4. Corretores veem apenas conversas de leads designados a eles (`leads.broker_id`)

---

## Detalhes Técnicos

### 1. Custo por mensagem e por chat

**Arquivo**: `src/components/integrations/whatsapp-agent/WhatsAppChatPanel.tsx`

- Importar `useUserRoles` e verificar `isAdmin || isSubAdmin`
- Para cada mensagem com `estimated_cost_usd > 0`, exibir abaixo do horário: `R$ 0,0012` (convertido ou em USD)
- No header do chat, exibir o custo total da conversa somando `estimated_cost_usd` de todas as `selectedMessages`
- Atualizar a interface `ChatMessage` em `useWhatsAppChat.ts` para incluir `estimated_cost_usd`

**Arquivo**: `src/hooks/useWhatsAppChat.ts`
- Adicionar `estimated_cost_usd` ao tipo `ChatMessage`
- Incluir o campo no select da query (já vem com `select("*")`)

### 2. Botão de Lead inteligente

**Arquivo**: `src/components/integrations/whatsapp-agent/WhatsAppChatPanel.tsx`

- Ao selecionar uma conversa (`selectedJid` muda), fazer lookup do lead pelo telefone via query à tabela `leads`
- Estado: `existingLead: Lead | null`
- Se lead existe: botão mostra "Lead Cadastrado ✓" (desabilitado ou abre detalhes)
- Se não existe: botão mostra "Cadastrar Lead" (comportamento atual)

Query:
```ts
const phone = selectedJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
const { data } = await supabase
  .from("leads")
  .select("id, name")
  .eq("organization_id", orgId)
  .eq("is_active", true)
  .ilike("phone", `%${phone.slice(-8)}`)
  .limit(1);
```

### 3. Abas do agente IA restritas a admin/sub_admin

**Arquivo**: `src/components/integrations/whatsapp-agent/WhatsAppAgentPanel.tsx`

- Importar `useUserRoles`
- Condicionalmente renderizar as abas de configuração (Comportamento, Imóveis, Qualificação, Transferência, Voz) apenas quando `isAdmin || isSubAdmin || isDeveloper`
- A aba **Chat** e **Conexão** permanecem visíveis para todos

### 4. Corretores veem apenas seus chats

**Arquivo**: `src/hooks/useWhatsAppChat.ts`

- Importar `useUserRoles`
- Se o usuário **não** for admin/sub_admin/developer/leader:
  - Buscar leads atribuídos ao corretor: `leads.broker_id = user.id`
  - Extrair os telefones desses leads
  - Filtrar `conversations` para mostrar apenas `remote_jid` que correspondem aos telefones dos leads do corretor
- Admins continuam vendo todas as conversas

Query adicional:
```ts
const { data: myLeads } = await supabase
  .from("leads")
  .select("phone")
  .eq("organization_id", orgId)
  .eq("broker_id", user.id)
  .eq("is_active", true);
```

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useWhatsAppChat.ts` | Adicionar `estimated_cost_usd` ao tipo, filtro de conversas por broker |
| `src/components/integrations/whatsapp-agent/WhatsAppChatPanel.tsx` | Custo por msg, custo por chat, botão lead inteligente |
| `src/components/integrations/whatsapp-agent/WhatsAppAgentPanel.tsx` | Restringir abas de config por role |

Nenhuma migração de banco necessária — os campos `estimated_cost_usd` e `broker_id` já existem.

