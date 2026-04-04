

## Plano: Conexão WhatsApp via Pairing Code

### Resumo
Adicionar uma segunda opção de conexão — por código de pareamento (8 dígitos) — como alternativa ao QR Code. O usuário digita o número de telefone com DDI, a Evolution API retorna um `pairingCode`, e ele insere esse código no WhatsApp do celular.

### 1. Edge Function `whatsapp-activate-webhook`

**Alteração**: Aceitar parâmetro opcional `phone_number` no body da requisição.

- Se `phone_number` presente: chamar `POST /instance/connect/{instanceName}` com body `{ "number": "5511..." }` — a Evolution API retorna `pairingCode` em vez de QR base64.
- Se `phone_number` ausente: manter fluxo atual (QR Code via GET).
- Retornar campo `pairingCode` na resposta quando aplicável.
- Salvar `phone_number` na tabela `whatsapp_agent_config`.

### 2. Frontend `WhatsAppIntegrationCard.tsx`

**Adicionar toggle entre dois modos de conexão**:

- **Modo QR Code** (atual, padrão): Escaneie o QR com o celular.
- **Modo Código de Pareamento**: Campo de input para telefone (com máscara `+55 (XX) XXXXX-XXXX`), botão "Gerar Código", exibição do código de 8 dígitos em formato OTP (usando `InputOTP` já existente no projeto) com instruções de como inserir no WhatsApp.

**UI flow**:
1. Tabs ou botões "QR Code" / "Código de Pareamento" no card de conexão.
2. No modo pareamento: input de telefone → clica "Gerar Código" → chama Edge Function com `phone_number` → exibe o código de 8 dígitos → polling de status idêntico ao fluxo QR.
3. Instruções: "Abra WhatsApp > Dispositivos Conectados > Conectar Dispositivo > Conectar com número de telefone > Insira o código abaixo".

### 3. Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-activate-webhook/index.ts` | Aceitar `phone_number`, usar POST com body `{ number }` para obter `pairingCode` |
| `src/components/integrations/WhatsAppIntegrationCard.tsx` | Adicionar toggle QR/Pairing, input de telefone, exibição do código OTP |

### Detalhes técnicos

**Evolution API — Pairing Code endpoint**:
```
POST /instance/connect/{instanceName}
Body: { "number": "5511999999999" }
Response: { "pairingCode": "ABCD-EFGH", "code": "...", "count": 1 }
```

**Resposta da Edge Function** (campo adicional):
```json
{
  "success": true,
  "pairingCode": "ABCD-EFGH",
  "qrCode": null,
  "connected": false,
  "status": "connecting"
}
```

