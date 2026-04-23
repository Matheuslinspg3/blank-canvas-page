

# WhatsApp Individual do Corretor -- Fase 1 (MVP)

## Objetivo

Permitir que cada corretor conecte seu proprio numero WhatsApp ao sistema, veja mensagens na inbox e responda pelo seu canal. Separacao total do agente IA institucional.

---

## Escopo da Fase 1

1. Tabela `broker_whatsapp_channels` com conexao, status e QR code
2. Edge Function `whatsapp-broker-instance` (connect/status/disconnect/delete)
3. Edge Function `whatsapp-broker-webhook` (recebe mensagens do Evolution e persiste)
4. Coluna `channel_type` em `whatsapp_messages` para discriminar org vs broker
5. Pagina "Meu WhatsApp" para o corretor conectar e ver status
6. Pagina "Canais da Equipe" para admin visualizar/desconectar canais
7. Inbox ja filtra por `broker_id` -- mensagens do canal broker aparecem naturalmente
8. Trigger `mirror_whatsapp_to_omnichannel` atualizado para propagar `channel_type`

---

## 1. Migracao de banco de dados

### 1.1 Tabela `broker_whatsapp_channels`

```sql
CREATE TABLE public.broker_whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text UNIQUE,
  instance_token text,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.broker_whatsapp_channels ENABLE ROW LEVEL SECURITY;

-- Corretor ve/edita apenas o proprio canal
CREATE POLICY "broker_own_channel_select" ON public.broker_whatsapp_channels
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "broker_own_channel_insert" ON public.broker_whatsapp_channels
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "broker_own_channel_update" ON public.broker_whatsapp_channels
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(auth.uid()));

CREATE POLICY "broker_own_channel_delete" ON public.broker_whatsapp_channels
  FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid()));
```

### 1.2 Coluna `channel_type` em `whatsapp_messages`

```sql
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS broker_channel_id uuid REFERENCES public.broker_whatsapp_channels(id);

CREATE INDEX idx_wa_msg_channel_type ON public.whatsapp_messages(channel_type);
CREATE INDEX idx_wa_msg_broker_channel ON public.whatsapp_messages(broker_channel_id) WHERE broker_channel_id IS NOT NULL;
```

### 1.3 Coluna `channel_type` na tabela `messages` (omnichannel)

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_subtype text DEFAULT 'org';
```

### 1.4 Atualizar trigger `mirror_whatsapp_to_omnichannel`

Propagar `channel_type` do `whatsapp_messages` para `messages.channel_subtype`, e resolver `channel_accounts` via `broker_whatsapp_channels` quando `channel_type = 'broker'`.

---

## 2. Edge Functions

### 2.1 `whatsapp-broker-instance` (nova)

Logica identica a `whatsapp-instance` mas opera sobre `broker_whatsapp_channels`:
- **status**: consulta Evolution API + N8N verifica, atualiza status
- **connect**: cria instancia no Evolution com nome `broker_{orgSlug}_{userId_short}`, salva token, retorna QR code
- **disconnect**: logout no Evolution, status = disconnected
- **delete**: remove instancia no Evolution, limpa campos

Autenticacao: JWT do usuario. Verifica que `user_id` bate com o canal. Admin pode operar qualquer canal da org.

### 2.2 `whatsapp-broker-webhook` (nova)

Recebe mensagens do Evolution API para canais broker:
- Resolve `instance_name` na tabela `broker_whatsapp_channels`
- Persiste em `whatsapp_messages` com `channel_type = 'broker'` e `broker_channel_id`
- NAO aciona pipeline de IA (sem chamada ao n8n agent)
- Trigger existente `mirror_whatsapp_to_omnichannel` cuida de espelhar para a inbox omnichannel

### 2.3 `whatsapp-broker-send` (nova)

Envia mensagem via Evolution API usando credenciais do canal broker:
- Resolve instancia de `broker_whatsapp_channels`
- Persiste em `whatsapp_messages` com `channel_type = 'broker'`, `from_me = true`, `sender_type = 'human'`

---

## 3. Frontend

### 3.1 Nova pagina: `/whatsapp/meu-canal`

- Acessivel pelo menu lateral como "Meu WhatsApp"
- Visivel apenas para papel `corretor`, `leader`, `sub_admin`, `admin`
- Card de conexao: QR Code, status (connected/connecting/disconnected), numero conectado
- Botoes: Conectar, Desconectar, Reconectar
- Reutiliza componentes visuais de `WhatsAppConnectionCard` existente

### 3.2 Nova pagina: `/whatsapp/canais-equipe` (admin only)

- Tabela listando todos os `broker_whatsapp_channels` da org
- Colunas: Corretor, Numero, Status, Conectado em
- Acao: Desconectar canal de um corretor
- Acessivel apenas para `admin` e `sub_admin`

### 3.3 Inbox (sem mudancas estruturais)

A inbox ja filtra conversas por `broker_id` para corretores. As mensagens do canal broker aparecerao naturalmente porque o trigger `mirror_whatsapp_to_omnichannel` as espelha para a tabela `conversations`/`messages`. Sera necessario apenas:
- Ao enviar resposta na inbox, verificar se a conversa pertence a um canal broker e rotear para `whatsapp-broker-send` em vez de `whatsapp-send`
- Adicionar badge visual indicando "Canal Pessoal" vs "Canal da Imobiliaria"

### 3.4 Menu lateral

Adicionar item "Meu WhatsApp" no sidebar, abaixo do item existente de WhatsApp/Agente IA.

---

## 4. Permissoes (RBAC)

| Acao | admin | sub_admin | leader | corretor | assistente |
|------|-------|-----------|--------|----------|------------|
| Conectar proprio numero | Sim | Sim | Sim | Sim | Nao |
| Desconectar proprio numero | Sim | Sim | Sim | Sim | Nao |
| Ver canais da equipe | Sim | Sim | Nao | Nao | Nao |
| Desconectar canal de outro | Sim | Sim | Nao | Nao | Nao |
| Editar agente IA (org) | Sim | Sim | Nao | Nao | Nao |

---

## 5. O que NAO muda

- `whatsapp_agent_config` continua sendo o agente IA da organizacao -- intocado
- `whatsapp-webhook-config` continua recebendo mensagens do canal institucional
- Pipeline de IA (n8n) nao e afetado
- `follow_up_queue` nao e alterado na Fase 1 (automacoes leves sao Fase 2)
- Billing de IA nao e impactado -- canais broker nao consomem creditos de IA

---

## 6. Arquivos a criar/editar

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx_broker_whatsapp_channels.sql` | Criar |
| `supabase/functions/whatsapp-broker-instance/index.ts` | Criar |
| `supabase/functions/whatsapp-broker-webhook/index.ts` | Criar |
| `supabase/functions/whatsapp-broker-send/index.ts` | Criar |
| `src/pages/whatsapp/MyWhatsAppChannel.tsx` | Criar |
| `src/pages/whatsapp/TeamChannels.tsx` | Criar |
| `src/components/whatsapp/BrokerConnectionCard.tsx` | Criar |
| `src/components/whatsapp/TeamChannelsTable.tsx` | Criar |
| `src/hooks/whatsapp/useBrokerChannel.ts` | Criar |
| `src/services/omnichannel/messagingService.ts` | Editar (rotear broker send) |
| `src/components/layout/Sidebar.tsx` (ou equiv.) | Editar (novo item menu) |
| `src/App.tsx` ou router | Editar (novas rotas) |
| Trigger `mirror_whatsapp_to_omnichannel` | Editar via migracao |

---

## 7. Criterios de aceite

1. Corretor consegue conectar QR code e ver status "connected"
2. Mensagens recebidas no numero do corretor aparecem na inbox
3. Corretor consegue responder pelo seu numero
4. Admin ve todos os canais da equipe e pode desconectar
5. Assistente nao consegue conectar numero
6. Mensagens do canal broker NAO acionam pipeline de IA
7. Canal institucional continua funcionando sem regressao

