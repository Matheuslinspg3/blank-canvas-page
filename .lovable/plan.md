## Objetivo
Trocar todas as chamadas HTTP da antiga Evolution API (Node) pela Evolution GO. Os secrets `EVOLUTION_GO_URL` e `EVOLUTION_GO_TOKEN` já existem. O `EVOLUTION_PROVIDER` será forçado para `evolution_go` como padrão.

## Convenção EvoGo (confirmada por você)
- Base URL: `EVOLUTION_GO_URL`
- Autenticação: header `Instance-Id: <instanceId>` (o próprio InstanceId autentica). Token global (`EVOLUTION_GO_TOKEN`) é enviado como `Authorization: Bearer …` quando presente.
- Sem `instanceName` na URL — a instância vai no header.
- Endpoints novos:
  - `POST /send/text` — body `{ number, text, delay?, quoted?, mentionedJid? }`
  - `POST /send/media` — body `{ number, url, type: "image"|"video"|"document", caption?, filename?, delay? }`
  - `POST /send/sticker`, `POST /send/contact`, `POST /send/location`, `POST /send/link`
  - Áudio: `POST /send/media` com `type: "audio"` (whatsmeow não tem endpoint dedicado de PTT — usaremos media/audio)
  - `POST /instance/create`, `POST /instance/connect`, `GET /instance/qr`, `GET /instance/status`, `DELETE /instance/logout`, `DELETE /instance/delete/{id}`, `POST /instance/pair`
  - `POST /message/downloadimage` (substitui o download de mídia antigo)

## Mudanças

### 1. `_shared/evolution-provider.ts` (core)
- Reescrever o branch `evolution_go`:
  - `request()` injeta `Instance-Id` header em todas as chamadas que precisam de instância (todas exceto `/instance/all` e `/instance/create`).
  - Remover header `apikey`; usar `Authorization: Bearer ${token}` se `EVOLUTION_GO_TOKEN` estiver setado.
  - Novos métodos: `sendMedia(instance, { number, url, type, caption?, filename?, delay? })`, `sendAudio(instance, { number, url })`, `downloadMedia(instance, payload)`.
  - Ajustar `sendText` para o novo body (sem `name`).
  - `setWebhook`: novo endpoint EvoGo (validar pela doc — manter fallback se 404).

### 2. Edge functions migradas para usar exclusivamente o provider
Todas deixam de ler `EVOLUTION_API_URL/EVOLUTION_API_GLOBAL_KEY` e passam a usar o helper:
- `whatsapp-send` (sendText + sendMedia)
- `whatsapp-send-media`
- `whatsapp-send-audio`
- `whatsapp-send-property-photos` (loop de `sendMedia`)
- `whatsapp-broker-send` (sendText + sendMedia)
- `whatsapp-download-media`
- `whatsapp-activate-webhook`
- `whatsapp-instance`, `whatsapp-broker-instance`
- `whatsapp-polling-status`, `whatsapp-refresh-qrcode`
- `whatsapp-broker-followup-executor`, `whatsapp-broker-webhook`
- `whatsapp-transfer-broker`

### 3. Helper centralizado
Criar `_shared/evo-go-client.ts` (wrapper enxuto sobre `fetch`) para os casos onde o `EvolutionProvider` é overkill (apenas envio direto). Ele exporta `evoGoSend(instanceId, endpoint, body)`.

### 4. Default provider
- Definir `EVOLUTION_PROVIDER` default como `"evolution_go"` no código (`Deno.env.get("EVOLUTION_PROVIDER") ?? "evolution_go"`).
- Manter o branch `evolution_node` no provider apenas como fallback explícito; nenhuma function vai mais ler diretamente as envs antigas.

## Detalhes técnicos
- `instance_name` no DB passa a guardar o **InstanceId** da EvoGo (a coluna já é genérica). Funções que recebem `instance_name` continuam funcionando — o valor é o ID.
- Para `sendMedia`, o EvoGo aceita URL pública. Continuamos resolvendo URLs R2/Cloudinary como hoje antes de enviar.
- Webhook continua chegando em `whatsapp-webhook` — o formato de mensagem do EvoGo é compatível com o whatsmeow (MESSAGES_UPSERT), mas vou validar `event_message` no parsing. Se diferente, ajusto `whatsapp-webhook` num passo seguinte.
- Em todas as funções, em caso de erro do EvoGo, logar `status + raw` para debug.

## Fora de escopo (nesta migração)
- Mudar formato persistido em `whatsapp_messages` (mantém igual).
- Refatorar n8n workflows — você já está usando o nó `evoGo` nativo no n8n.
- Migrar `whatsapp-webhook` para novo formato (só ajusto se o webhook do EvoGo divergir do esperado — depende de teste real).

## Passos
1. Atualizar `_shared/evolution-provider.ts` (auth + endpoints + novos métodos).
2. Refatorar `whatsapp-send-media`, `whatsapp-send-audio`, `whatsapp-send-property-photos`, `whatsapp-send`, `whatsapp-broker-send`, `whatsapp-download-media`.
3. Refatorar restantes (instance/webhook/polling/refresh-qr/followup/transfer-broker).
4. Setar `EVOLUTION_PROVIDER=evolution_go` como default em todo o código.
5. Testar com `supabase--curl_edge_functions` no `whatsapp-send-property-photos` (reproduzir o caso N8N do erro original).