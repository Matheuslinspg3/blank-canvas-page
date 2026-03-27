

# Plano Definitivo — Arquitetura WhatsApp Agent (Valentina)

## Contexto e Decisoes Confirmadas

- **Provedor**: Evolution API (self-hosted)
- **N8N**: Retorna token + dados no webhook de ativacao
- **Seguranca**: Header `X-Webhook-Secret` para Edge Functions do agente
- **whatsapp-send**: Mantido para CRM manual + agente (alinhado com token oficial)

---

## Inventario Atual e Destino

```text
EDGE FUNCTION               ESTADO ATUAL                    DESTINO
─────────────────────────────────────────────────────────────────────────
whatsapp-activate-webhook    Provisioning via N8N            MANTER (refatorar)
whatsapp-instance            CRUD direto na Evolution API    REFATORAR (remover create/connect)
whatsapp-polling-status      Polling via N8N webhook         MANTER (simplificar)
whatsapp-refresh-qrcode      QR refresh via N8N webhook      MANTER
whatsapp-send                Envio direto via Evolution      MANTER (usar token oficial)
whatsapp-agent-config        Config do agente (sem auth)     PROTEGER com secret
whatsapp-agent-properties    Busca de imoveis (sem auth)     PROTEGER com secret
```

---

## Machine State da Instancia

```text
                    ┌──────────────┐
                    │   (vazio)    │  Nenhum registro em whatsapp_instances
                    └──────┬───────┘
                           │ usuario clica "Ativar"
                           ▼
                    ┌──────────────┐
                    │ provisioning │  Registro criado, aguardando resposta do N8N
                    └──────┬───────┘
                           │ N8N retorna token + QR
                           ▼
                    ┌──────────────┐
                    │  connecting  │  Token salvo, QR exibido, polling ativo
                    └──────┬───────┘
                           │ polling detecta "open"
                           ▼
                    ┌──────────────┐
                    │  connected   │  Operacional, abas do agente visiveis
                    └──────┬───────┘
                      │         │
            desconectar│         │ erro/timeout
                      ▼         ▼
                    ┌──────────────┐
                    │ disconnected │  Pode reconectar ou deletar
                    └──────────────┘
```

Transicoes validas:
- `(vazio)` → `provisioning` (via activate)
- `provisioning` → `connecting` (token recebido)
- `connecting` → `connected` (polling detecta open)
- `connecting` → `disconnected` (timeout/erro)
- `connected` → `disconnected` (usuario ou falha)
- `disconnected` → `connecting` (reconexao)
- qualquer → `(vazio)` (delete)

---

## Fase 1 — Saneamento

### 1.1 Remover actions mortas do `whatsapp-instance`

Remover as actions `create` e `connect` da Edge Function. Manter apenas:
- `status` — consulta o estado real na Evolution API usando token do banco
- `disconnect` — desconecta a sessao na Evolution
- `delete` — remove instancia na Evolution + banco

### 1.2 Limpar `useWhatsAppInstance.ts`

- Remover `createMutation` e `connectMutation` (actions mortas)
- Remover `createInstance` e `connectInstance` do retorno
- Manter: `checkStatus`, `disconnectInstance`, `deleteInstance`

### 1.3 Limpar `WhatsAppIntegrationCard.tsx`

- Remover `handleConnect` (usava action "connect" direto)
- Remover botao "Conectar" que chamava `connectInstance`
- O unico botao de ativacao chama `handleActivate` (via `whatsapp-activate-webhook`)
- Separar logica de polling/QR do componente visual

### 1.4 Proteger Edge Functions do agente

Adicionar validacao de `X-Webhook-Secret` em:
- `whatsapp-agent-config`
- `whatsapp-agent-properties`

Implementacao:
```typescript
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");
const requestSecret = req.headers.get("X-Webhook-Secret");
if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: corsHeaders
  });
}
```

**Secret necessario**: `WHATSAPP_AGENT_SECRET` — adicionado via ferramenta de secrets.

### 1.5 Remover token hardcoded

Deletar a migracao `20260327045819` que fez UPDATE manual do token. O token deve vir exclusivamente do fluxo de provisioning.

---

## Fase 2 — Provisioning Unificado

### Fluxo unico

```text
Frontend                Edge Function                    N8N                   Evolution API
   │                    (activate-webhook)                │                        │
   │── Ativar ─────────►│                                 │                        │
   │                    │── POST webhook ────────────────►│                        │
   │                    │   {orgName, orgId, companyId}   │── create instance ───►│
   │                    │                                 │◄── token+qr+status ──│
   │                    │◄── {token,instanceName,qr,     │                        │
   │                    │     status,phone} ──────────────│                        │
   │                    │                                 │                        │
   │                    │── upsert whatsapp_instances     │                        │
   │                    │   (token, name, status, qr)     │                        │
   │                    │                                 │                        │
   │◄── {qrCode, ctx} ─│                                 │                        │
   │                    │                                 │                        │
   │── polling cada 10s─►│ (polling-status)               │                        │
   │                    │── POST polling webhook ────────►│── check status ──────►│
   │                    │◄── {connected, phone} ──────────│◄── connectionState ──│
   │                    │── UPDATE status="connected"     │                        │
   │◄── connected ──────│                                 │                        │
```

### Refatorar `whatsapp-activate-webhook`

- Extrair token da resposta do N8N e persistir no banco (ja faz parcialmente)
- Garantir que o status inicial seja `provisioning` se nao vier QR
- Garantir que o status seja `connecting` se vier QR
- Garantir que o status seja `connected` se a Evolution ja reportar open

### Contrato de payload — Webhook Ativacao

**Request (app → N8N):**
```json
{
  "orgName": "portocaicara",
  "orgId": "003",
  "companyId": "uuid-da-organizacao"
}
```

**Response esperada (N8N → app):**
```json
{
  "success": true,
  "data": {
    "instanceName": "portocaicara-003",
    "token": "abc123-token-da-evolution",
    "connectionStatus": "open|close|connecting",
    "qrCode": "base64...",
    "pairingCode": "ABCD-1234",
    "ownerJid": "5562...@s.whatsapp.net"
  }
}
```

### Contrato de payload — Webhook Polling

**Request (app → N8N):**
```json
{
  "orgName": "portocaicara",
  "orgId": "003",
  "companyId": "uuid"
}
```

**Response (N8N → app):**
```json
{
  "connectionStatus": "open",
  "ownerJid": "5562...@s.whatsapp.net"
}
```

### Contrato de payload — Webhook QR Refresh

**Request:** mesmo de hoje (pairingCode, code, count, orgName, orgId, companyId)
**Response:** `{ qrCode: "base64...", pairingCode, code, count }`

---

## Fase 3 — Operacao

### 3.1 `whatsapp-instance` (refatorado)

Apenas 3 actions, todas usando token oficial do banco:

**status**: GET /instance/connectionState na Evolution. Se token invalido, retorna status do banco com warning.

**disconnect**: POST /instance/logout na Evolution. UPDATE status = "disconnected".

**delete**: DELETE /instance/delete na Evolution. DELETE do registro no banco.

### 3.2 `whatsapp-send` (alinhado)

Continua funcionando como hoje, mas:
- Usa token do banco (ja faz)
- Se token invalido, retorna erro claro em vez de 500 generico
- Adicionar log de auditoria (organization_id, phone, timestamp)

### 3.3 Frontend — Reconexao

Quando status = "disconnected" e instancia existe:
- Botao "Reconectar" chama `whatsapp-activate-webhook` novamente
- Mesmo fluxo do provisioning, mas faz UPDATE em vez de INSERT

### 3.4 Auto-check no mount

Manter o `useEffect` que verifica status ao montar o componente. Se connected, limpa QR. Se disconnected, mostra opcao de reconectar.

---

## Fase 4 — Observabilidade e Seguranca

### 4.1 Logs de auditoria

Nova tabela:
```text
whatsapp_audit_log
├── id (uuid PK)
├── organization_id (FK)
├── action (text: activate, connect, disconnect, delete, send, status_check)
├── actor_id (uuid, nullable — user ou system)
├── details (jsonb)
├── created_at (timestamptz)
```

RLS: SELECT para managers da org. INSERT via service-role nas Edge Functions.

### 4.2 Validacao por organizacao

Nas Edge Functions do agente (`agent-config`, `agent-properties`):
- Alem do `X-Webhook-Secret`, validar que o `organization_id` enviado existe e esta ativo

### 4.3 Rate limiting basico

Para `whatsapp-agent-config` e `whatsapp-agent-properties`:
- Rate limit em memoria: max 60 requests/minuto por organization_id
- Suficiente para o volume do agente

### 4.4 Idempotencia no provisioning

- Se `whatsapp-activate-webhook` for chamado com instancia ja existente e connected:
  - Retorna dados atuais sem chamar o N8N novamente (ja faz parcialmente)
- Se existente mas disconnected:
  - Chama N8N para reconectar

---

## Tabelas — Estado Final

### `whatsapp_instances` (existente, sem alteracao de schema)

```text
id, organization_id, instance_name, instance_token, status, qr_code, phone_number, created_at, updated_at
```

Status enum efetivo: `provisioning | connecting | connected | disconnected`

### `whatsapp_agent_config` (existente, sem alteracao)

### `whatsapp_property_rules` (existente, sem alteracao)

### `whatsapp_audit_log` (nova)

---

## Riscos e Trade-offs

| Risco | Mitigacao |
|---|---|
| N8N fora do ar durante provisioning | Fire-and-forget com retry manual (botao "Tentar novamente") |
| Token retornado pelo N8N nao chega | Parser robusto com fallback + log detalhado |
| Evolution API muda formato de resposta | Parser com multiplos caminhos (ja existe, manter) |
| Secret do agente vaza | Rotacao manual + alerta se request sem secret aumentar |
| Rate limit em memoria reseta no cold start | Aceitavel para o volume atual; migrar para DB se necessario |

---

## Resumo de Arquivos

### Fase 1
- `whatsapp-instance/index.ts` — remover actions create/connect
- `useWhatsAppInstance.ts` — remover createMutation, connectMutation
- `WhatsAppIntegrationCard.tsx` — remover handleConnect, simplificar
- `whatsapp-agent-config/index.ts` — adicionar X-Webhook-Secret
- `whatsapp-agent-properties/index.ts` — adicionar X-Webhook-Secret
- Nova migracao: reverter token hardcoded (se necessario)
- Secret: `WHATSAPP_AGENT_SECRET`

### Fase 2
- `whatsapp-activate-webhook/index.ts` — garantir persistencia completa do token
- Sem novas Edge Functions

### Fase 3
- `whatsapp-instance/index.ts` — ajustar status/disconnect/delete
- `whatsapp-send/index.ts` — melhorar erro de token invalido
- `WhatsAppIntegrationCard.tsx` — botao reconectar

### Fase 4
- Nova migracao: tabela `whatsapp_audit_log`
- Todas as Edge Functions de WhatsApp: adicionar insert no audit_log
- `whatsapp-agent-config/index.ts` e `whatsapp-agent-properties/index.ts`: rate limit

