

## Diagnóstico

**Causa raiz identificada**: O endpoint `/platform/contacts/{uuid}` da API do RD Station **não retorna dados de conversão** (`first_conversion`, `last_conversion`, `conversion_identifier`). Ele retorna apenas dados básicos do contato (nome, email, campos customizados, `last_conversion_date` como timestamp).

Os dados de conversão (qual formulário/anúncio o lead veio) estão no endpoint separado: `/platform/contacts/{uuid}/events` — que retorna os eventos do tipo CONVERSION com `event_identifier` (nome do formulário/landing page).

Isso explica por que:
- O `fix-leads` chama a API, recebe o contato, mas `extractConversionIdentifier()` retorna `null` → nenhum campo é atualizado → "nenhuma correção necessária"
- Os logs de `rd-station-sync-leads` mostram `[events] Failed for ... 400` — o endpoint de eventos está falhando com erro 400 para todos os contatos

## Plano

### 1. Atualizar `fix-leads` para buscar eventos de conversão

**Arquivo**: `supabase/functions/fix-leads/index.ts`

- Adicionar função `fetchRDContactEvents(uuid, accessToken)` que chama `GET /platform/contacts/{uuid}/events`
- Após buscar o contato básico, buscar também os eventos
- Extrair `event_identifier` do primeiro evento CONVERSION como `conversion_identifier`
- Extrair `event_source` como `traffic_source`
- Incluir detalhes dos eventos nas `notes` reconstruídas

### 2. Corrigir endpoint de eventos (400 error)

**Arquivo**: `supabase/functions/rd-station-sync-leads/index.ts`

- Investigar e corrigir o endpoint `/platform/contacts/{uuid}/events` — a API do RD Station Marketing usa `/platform/contacts/{identifier}/events` com query params opcionais (`event_type`, `page`, `page_size`)
- Possivelmente o 400 vem de headers ou parâmetros incorretos; ajustar a chamada

### 3. Atualizar sync para preencher `conversion_identifier` via eventos

**Arquivo**: `supabase/functions/rd-station-sync-leads/index.ts`

- Na função `processContacts`, após importar eventos, usar o primeiro evento CONVERSION para preencher `conversion_identifier` e `traffic_source` no lead se ainda vazios

### Detalhes Técnicos

```text
Fluxo atual (quebrado):
  fix-leads → GET /contacts/{uuid} → sem dados de conversão → 0 correções

Fluxo corrigido:
  fix-leads → GET /contacts/{uuid}        → dados básicos (nome, phone, etc.)
           → GET /contacts/{uuid}/events  → CONVERSION events
           → event_identifier = conversion_identifier
           → event_source = traffic_source
```

- Rate limit: manter 200ms entre chamadas (já existente)
- Limite: processar no máximo os 5 eventos mais recentes por lead para extrair dados
- Deploy automático de ambas as edge functions após edição

