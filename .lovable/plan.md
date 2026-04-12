

# Plano: Adicionar Retell AI na página de Automações

## Visão Geral

Criar uma nova aba "Voz (Retell)" na página de Automações, com configuração do agente, widget de chamada web e histórico de chamadas. Como você ainda não tem conta na Retell AI, o fluxo começa com um guia de setup.

## Passo 1: Guia de Setup + Secrets

Antes de codificar, você precisará:
1. Criar conta em [dashboard.retellai.com](https://dashboard.retellai.com)
2. Criar um agente no painel da Retell
3. Copiar **API Key** e **Agent ID**
4. Eu adicionarei os secrets `RETELL_API_KEY` e `RETELL_AGENT_ID` no Supabase

## Passo 2: Edge Function `retell-create-web-call`

Nova Edge Function que:
- Recebe requisição autenticada do frontend
- Chama `POST https://api.retellai.com/v2/create-web-call` com `agent_id` e `RETELL_API_KEY`
- Retorna o `access_token` para iniciar a chamada via WebRTC no browser
- Opcionalmente recebe `metadata` (lead_id, nome) para contexto

## Passo 3: Componente `RetellVoicePanel.tsx`

Novo componente em `src/components/automations/retell/`:

- **Card de configuração**: mostra status da integração (conectado/não configurado), Agent ID
- **Widget de chamada web**: botão "Iniciar Chamada" que chama a Edge Function, recebe o token e usa o SDK `retell-client-js-sdk` para WebRTC
- **Indicadores visuais**: status idle/connecting/connected/speaking (igual ao VoiceChatWidget atual)
- **Informações do agente**: nome, modelo de voz configurado na Retell

## Passo 4: Nova aba em `Automations.tsx`

Adicionar tab "Voz (Retell)" com ícone `Phone` entre "Follow-up" e o final:

```text
Automações | Templates | Logs | Score | Agente IA (WhatsApp) | Follow-up | Voz (Retell)
```

Protegida por `canConfigureAgent` (admin/subadmin/dev).

## Passo 5: Tabela `voice_calls` (migração)

Criar tabela para histórico de chamadas:

```sql
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID REFERENCES leads(id),
  call_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  call_type TEXT DEFAULT 'web_call',
  call_status TEXT DEFAULT 'registered',
  duration_ms INTEGER,
  transcript TEXT,
  recording_url TEXT,
  sentiment TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Com RLS por `organization_id`.

## Passo 6: Webhook `retell-webhook` (Edge Function)

Edge Function para receber webhooks da Retell com status de chamadas:
- `call_started`, `call_ended`, `call_analyzed`
- Atualiza `voice_calls` com duração, transcrição e sentimento
- Autenticação via assinatura HMAC ou `X-Webhook-Secret`

## Arquivos Novos

```text
src/components/automations/retell/RetellVoicePanel.tsx
src/components/automations/retell/RetellCallWidget.tsx
src/components/automations/retell/RetellCallHistory.tsx
supabase/functions/retell-create-web-call/index.ts
supabase/functions/retell-webhook/index.ts
```

## Arquivos Alterados

- `src/pages/Automations.tsx` — nova aba
- `package.json` — adicionar `retell-client-js-sdk`

## Dependência

- `retell-client-js-sdk` (SDK oficial para WebRTC no browser)

## Sequência de Implementação

1. Solicitar secrets (RETELL_API_KEY, RETELL_AGENT_ID)
2. Criar migração `voice_calls`
3. Criar Edge Functions
4. Criar componentes React
5. Adicionar aba em Automations

