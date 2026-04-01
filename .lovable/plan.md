

## Follow-up Completo: Log, View e UI Avançada

### O que existe hoje
- Tabela `follow_up_queue` com RLS
- Colunas de follow-up na `whatsapp_agent_config`
- Edge Functions: `whatsapp-followup-batch`, `whatsapp-followup-update`, `whatsapp-followup-auto-enqueue`
- UI básica em `FollowUpConfigPanel.tsx` com 3 sub-abas (Contatos, Fila, Configuração)
- Trigger SQL de sync na `whatsapp_messages`

### O que será implementado

---

### 1. Migration SQL

**Tabela `follow_up_log`** (histórico de tentativas, append-only):
- Campos: `queue_id`, `org_id`, `lead_phone`, `attempt_number`, `message_sent`, `message_source` (template_1/ai_generated/template_3/manual), `sent_at`, `delivery_status`
- Indexes para queue_id, org+phone, sent_at DESC
- RLS: SELECT para membros da org, ALL para service_role

**View `whatsapp_contacts_followup_view`**:
- Agrega contatos únicos de `whatsapp_messages` (última mensagem, sender_type, total msgs)
- LEFT JOIN com `follow_up_queue` para trazer status, tentativas, próximo envio
- Nome de exibição: `COALESCE(fq.lead_name, remote_jid)`

---

### 2. Edge Function `whatsapp-followup-update` (atualização)

Ao receber `action = "sent"`, além de atualizar a fila, inserir registro na `follow_up_log` com:
- `message_sent` e `message_source` recebidos no body (campos opcionais novos)

---

### 3. UI Completa — `FollowUpConfigPanel.tsx` (reescrita)

Substituir o componente atual por uma versão completa com:

**Sub-aba Contatos:**
- Tabela usando a view `whatsapp_contacts_followup_view`
- Colunas: Contato, Última mensagem (texto truncado), Tempo (formatDistanceToNow), Status follow-up (badge colorido), Tentativas (X/3), Próximo envio, Ações
- Filtro dropdown por status (Todos/Pendente/Respondido/Completo/Opt-out/Sem follow-up)
- Busca por nome/telefone
- Paginação de 20 itens
- Realtime subscription na `follow_up_queue`

**Coluna Ações (3 botões):**

1. **Enviar follow-up manual** (modal):
   - Nome + telefone read-only
   - Textarea pré-preenchida com template_1 (variáveis substituídas)
   - Upsert na `follow_up_queue` + INSERT na `follow_up_log` com source='manual'
   - Só aparece se: followup_enabled, NOT opted_out, NOT max attempts

2. **Ver histórico** (drawer lateral):
   - Dados do contato (nome, telefone, imóvel)
   - Timeline da `follow_up_log` por org_id + lead_phone
   - Cada entrada: data/hora, tipo (badge), texto enviado
   - Aviso se opted_out

3. **Parar follow-up / Reativar:**
   - Se pendente: botão "Parar" com confirmação, chama edge function com action='opted_out'
   - Se responded/completed/opted_out: botão "Reativar" que reseta status/attempt_count/opted_out

**Sub-aba Fila:** Mantém tabela existente com melhorias visuais

**Sub-aba Configuração:** Mantém formulário existente + campo `followup_max_attempts`

---

### Arquivos modificados/criados

| Arquivo | Ação |
|---------|------|
| Migration SQL (1 arquivo) | Criar tabela `follow_up_log` + view |
| `supabase/functions/whatsapp-followup-update/index.ts` | Adicionar insert na `follow_up_log` no action="sent" |
| `src/components/automations/FollowUpConfigPanel.tsx` | Reescrever com todas as features |

