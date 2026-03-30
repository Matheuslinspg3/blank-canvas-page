

## Correção: Leads do RD Station sem anúncio/formulário na sincronização

### Problema
Os leads importados via sync (auto e manual) chegam **sem `conversion_identifier`** porque a API de contatos do RD Station (`/platform/contacts/{uuid}`) frequentemente **não retorna** os campos `first_conversion`/`last_conversion`. A função `fix-leads` resolve isso depois porque ela chama o endpoint `/platform/contacts/{uuid}/events`, que é a fonte real dos dados de conversão.

Todos os 33 registros no `rd_station_webhook_logs` são do tipo `api_sync` — ou seja, os leads estão vindo pela sincronização, não pelo webhook HTTP.

### Solução
Adicionar a mesma lógica de busca de eventos (`/events`) que o `fix-leads` usa diretamente no fluxo de criação de leads do `rd-station-sync-leads`. Assim o lead já chega com o `conversion_identifier` e `traffic_source` preenchidos.

### Mudanças

**Arquivo: `supabase/functions/rd-station-sync-leads/index.ts`**

1. **Criar função `fetchContactEvents`** — idêntica à `fetchRDContactEvents` do fix-leads, buscando `/platform/contacts/{uuid}/events?event_type=CONVERSION`

2. **No `processContacts` (linha ~678)** — após `fetchFullContactDetails`, chamar `fetchContactEvents` para obter os eventos de conversão. Extrair `event_identifier` e `event_source` dos eventos retornados.

3. **Preencher `conversion_identifier` e `traffic_source`** a partir dos eventos quando `extractConversionIdentifier(contact)` retornar null:
   - Coletar todos os `event_identifier` dos eventos de tipo CONVERSION
   - Usar o `event_source` do primeiro evento como `traffic_source`

4. **Aplicar a mesma lógica nas atualizações de leads existentes** (blocos de duplicate por email/phone, linhas ~726 e ~772) — se o lead existente não tem `conversion_identifier`, buscar os eventos e preencher.

### Detalhes Técnicos

```typescript
// Nova função a adicionar
async function fetchContactEvents(uuid: string, apiHeaders: Record<string, string>): Promise<any[]> {
  try {
    let res = await fetchWithTimeout(
      `https://api.rd.services/platform/contacts/${uuid}/events?event_type=CONVERSION&page=1&page_size=10`,
      apiHeaders, 10000
    );
    if (res.status === 400) {
      res = await fetchWithTimeout(
        `https://api.rd.services/platform/contacts/${uuid}/events?page=1&page_size=10`,
        apiHeaders, 10000
      );
    }
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.events) ? data.events : (Array.isArray(data) ? data : []);
  } catch { return []; }
}

// Nova função para extrair dados dos eventos
function extractFromEvents(events: any[]): { conversionId: string | null; trafficSource: string | null } {
  const conversionEvents = events.filter((e: any) => (e.event_type || e.type) === "CONVERSION");
  const ids = conversionEvents
    .map((e: any) => e.event_identifier || e.conversion_identifier)
    .filter(Boolean);
  const source = conversionEvents.find((e: any) => e.event_source)?.event_source || null;
  return {
    conversionId: ids.length > 0 ? ids.join(", ") : null,
    trafficSource: source,
  };
}
```

No `processContacts`, após buscar full contact details:
```typescript
// Buscar eventos de conversão para preencher conversion_identifier
let eventConversionId: string | null = null;
let eventTrafficSource: string | null = null;
if (contact.uuid && apiHeaders) {
  const events = await fetchContactEvents(contact.uuid, apiHeaders);
  const extracted = extractFromEvents(events);
  eventConversionId = extracted.conversionId;
  eventTrafficSource = extracted.trafficSource;
  await sleep(200);
}

// Na hora de extrair conversionId:
const conversionId = extractConversionIdentifier(contact) || eventConversionId;
const trafficSource = extractTrafficSource(contact) || eventTrafficSource;
```

### Impacto
- Leads novos já chegam com anúncio/formulário preenchido
- Leads duplicados existentes também são atualizados com os dados de conversão
- Adiciona ~1 request extra por lead (com rate limit de 200ms entre chamadas)
- Redeploy da Edge Function `rd-station-sync-leads`

