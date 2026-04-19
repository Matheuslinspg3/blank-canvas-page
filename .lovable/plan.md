

# Fase 1 — Implementação Final

Plano aprovado mantido. Aplico os 2 cuidados de execução.

## Cuidado #1 — Detecção explícita de ambiguidade de lead

Substituo `SELECT ... INTO ... LIMIT 2` por **CTE com contagem limitada via `array_agg`**:

```sql
WITH normalized AS (
  SELECT regexp_replace(split_part(NEW.remote_jid, '@', 1), '\D', '', 'g') AS phone_norm
),
matches AS (
  SELECT id
  FROM leads
  WHERE organization_id = NEW.organization_id
    AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = (SELECT phone_norm FROM normalized)
    AND (SELECT phone_norm FROM normalized) <> ''
  LIMIT 2  -- corta cedo: nunca precisamos saber se são 2, 3 ou 100
),
agg AS (
  SELECT array_agg(id) AS ids, COUNT(*) AS n FROM matches
)
SELECT CASE WHEN n = 1 THEN ids[1] ELSE NULL END
INTO v_lead_id
FROM agg;
```

Semântica explícita:
- `n = 0` → `v_lead_id = NULL` (sem match)
- `n = 1` → `v_lead_id = ids[1]` (match único)
- `n = 2` (= "≥2", graças ao `LIMIT 2`) → `v_lead_id = NULL` (ambíguo)
- Phone vazio → curto-circuito via `phone_norm <> ''` retorna 0 rows → NULL

Sem ambiguidade semântica. `LIMIT 2` apenas otimiza (não precisa scan completo).

## Cuidado #2 — Upsert null-safe de timestamps

Problema com `GREATEST` puro: em Postgres, `GREATEST(NULL, x) = x` (ignora NULLs) — então `GREATEST` **já é null-safe para o caso comum**. MAS há um caso onde quebra: se ambos os lados forem NULL, retorna NULL — comportamento correto, mas perigoso ao combinar com lógica de preview que compara timestamps.

Solução robusta: usar `GREATEST` (que ignora NULLs) **+** comparação de preview com `COALESCE` para o sentinel `'-infinity'::timestamptz`, garantindo que preview avance mesmo quando o existente é NULL:

```sql
ON CONFLICT (channel_account_id, external_contact_id) DO UPDATE SET
  -- Enriquecimento (não sobrescreve com NULL)
  lead_id               = COALESCE(conversations.lead_id, EXCLUDED.lead_id),
  customer_display_name = COALESCE(conversations.customer_display_name, EXCLUDED.customer_display_name),

  -- Timestamps null-safe: GREATEST ignora NULLs nativamente; COALESCE garante que NULL atual aceita valor novo
  last_message_at  = GREATEST(conversations.last_message_at,  EXCLUDED.last_message_at),
  last_inbound_at  = GREATEST(conversations.last_inbound_at,  EXCLUDED.last_inbound_at),
  last_outbound_at = GREATEST(conversations.last_outbound_at, EXCLUDED.last_outbound_at),

  -- Preview: avança apenas se a nova mensagem é >= a última registrada (ou se não havia nenhuma)
  -- COALESCE com '-infinity' resolve o caso last_message_at IS NULL no row existente
  last_message_preview = CASE
    WHEN EXCLUDED.last_message_at IS NOT NULL
         AND EXCLUDED.last_message_at >= COALESCE(conversations.last_message_at, '-infinity'::timestamptz)
         AND COALESCE(EXCLUDED.last_message_preview, '') <> ''
    THEN EXCLUDED.last_message_preview
    ELSE conversations.last_message_preview
  END,

  updated_at = now();
```

Casos cobertos:
- Insert ordenado normal → tudo avança
- Insert fora de ordem (mensagem antiga chegando depois) → `GREATEST` mantém o mais recente; preview NÃO regride (`>=`)
- Backfill em conversa nova → todos os campos preenchem a partir de NULL
- Backfill em conversa existente → enriquece sem regredir
- Mensagem só com mídia (text NULL) → preview existente preservado (`<> ''`)
- Mensagem outbound → `EXCLUDED.last_inbound_at = NULL`, `GREATEST(existing, NULL) = existing` ✓

## Arquivos a criar

**1 migração SQL idempotente:**
- `supabase/migrations/<ts>_omnichannel_foundation.sql`
  - 4 enums (`channel_type`, `conversation_status`, `message_direction`, `message_sender_type`) com guard `DO $$ ... duplicate_object`
  - Tabela `channel_accounts` + indexes + RLS (manager-only)
  - Tabela `conversations` (sem `unread_count`) + indexes + RLS (manager vê tudo; broker via `leads.broker_id`)
  - Tabela `messages` (com `channel_account_id` denormalizado) + `UNIQUE (source_table, source_id)` + `UNIQUE (conversation_id, external_message_id) WHERE external_message_id IS NOT NULL` + RLS espelhando conversations
  - Tabela `inbox_assignments` + RLS
  - Função `mirror_whatsapp_to_omnichannel()` SECURITY DEFINER, envelope `EXCEPTION WHEN OTHERS THEN RAISE WARNING; RETURN NEW`
  - Trigger AFTER INSERT e AFTER UPDATE em `whatsapp_messages` (lógicas separadas conforme plano)
  - Função `backfill_omnichannel_from_whatsapp(org_id uuid DEFAULT NULL, batch_size int DEFAULT 1000)` idempotente, com recálculo final agregado por conversation
  - Trigger `set_updated_at` em `conversations` e `channel_accounts`

**Camada TypeScript read-only:**
- `src/types/omnichannel.ts`
- `src/services/omnichannel/channelAccountsService.ts`
- `src/services/omnichannel/conversationsService.ts`
- `src/services/omnichannel/messagesService.ts`
- `src/hooks/omnichannel/useChannelAccounts.ts`
- `src/hooks/omnichannel/useConversations.ts`
- `src/hooks/omnichannel/useConversationMessages.ts`

## Fora desta fase
UI, Instagram/Messenger, business_hours, distribuição automática, edição das edge functions, mudança no n8n, `unread_count`, `reconcile_orphan_conversations` (TODO Fase 2).

## Rollback
`DROP TRIGGER` → `DROP FUNCTION` → `DROP TABLE` (reversa) → `DROP TYPE`. Reversível em uma transação.

