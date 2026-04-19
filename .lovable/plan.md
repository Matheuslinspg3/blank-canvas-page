

## Resumo do problema

Auditei a função atual (`supabase/migrations/20260419163300_*.sql` linhas 191-339):

**Problema 1 — UPDATE:** o branch `TG_OP='UPDATE'` (linhas 208-215) **já está correto** — sai cedo, só faz `UPDATE messages SET content_text, media_url WHERE source_table/source_id`, não toca conversation/contadores. Porém:
- Não propaga `metadata` (campo mutável legítimo no WA — ex: download de mídia anexa info ao JSONB).
- Falta cláusula `WHEN` no trigger UPDATE incluir `metadata` para disparar quando só ele mudar.

**Problema 2 — timestamps:** linhas 309-311 usam `GREATEST` puro. Tecnicamente, `GREATEST` no Postgres ignora NULLs nativamente (desde 8.1), então funciona. Mas o usuário quer **explicitamente null-safe via `CASE`/`COALESCE`**, defensivo e legível, sem depender de comportamento implícito do operador.

## Diff conceitual

**Função `mirror_whatsapp_to_omnichannel`:**
- Branch UPDATE: adicionar `metadata = COALESCE(NEW.metadata, messages.metadata)` (preserva existente se NEW vier NULL).
- Branch INSERT, upsert de conversation: substituir `GREATEST(a, b)` por `CASE` explícito que cobre os 4 casos (ambos NULL, só A, só B, ambos).

**Trigger UPDATE em whatsapp_messages:**
- Adicionar `OLD.metadata IS DISTINCT FROM NEW.metadata` à cláusula `WHEN`.

## Função SQL corrigida (apenas trechos alterados)

**Branch UPDATE (substitui linhas 208-215):**
```sql
IF TG_OP = 'UPDATE' THEN
  UPDATE public.messages
     SET content_text = NEW.message_text,
         media_url    = NEW.media_url,
         metadata     = COALESCE(NEW.metadata, messages.metadata)
   WHERE source_table = 'whatsapp_messages'
     AND source_id    = NEW.id;
  RETURN NEW;
END IF;
```

**Upsert de conversation — timestamps null-safe explícitos (substitui linhas 309-311):**
```sql
last_message_at = CASE
  WHEN conversations.last_message_at IS NULL THEN EXCLUDED.last_message_at
  WHEN EXCLUDED.last_message_at      IS NULL THEN conversations.last_message_at
  WHEN EXCLUDED.last_message_at > conversations.last_message_at THEN EXCLUDED.last_message_at
  ELSE conversations.last_message_at
END,
last_inbound_at = CASE
  WHEN conversations.last_inbound_at IS NULL THEN EXCLUDED.last_inbound_at
  WHEN EXCLUDED.last_inbound_at      IS NULL THEN conversations.last_inbound_at
  WHEN EXCLUDED.last_inbound_at > conversations.last_inbound_at THEN EXCLUDED.last_inbound_at
  ELSE conversations.last_inbound_at
END,
last_outbound_at = CASE
  WHEN conversations.last_outbound_at IS NULL THEN EXCLUDED.last_outbound_at
  WHEN EXCLUDED.last_outbound_at      IS NULL THEN conversations.last_outbound_at
  WHEN EXCLUDED.last_outbound_at > conversations.last_outbound_at THEN EXCLUDED.last_outbound_at
  ELSE conversations.last_outbound_at
END,
```

Cobre os 4 casos:
- atual NULL, novo X → X (preenche)
- atual X, novo NULL → X (preserva, não regride)
- ambos preenchidos → maior dos dois (idempotente sob reordenação)
- ambos NULL → NULL (estado consistente)

**Trigger UPDATE — incluir `metadata` no `WHEN`:**
```sql
DROP TRIGGER IF EXISTS mirror_whatsapp_to_omnichannel_upd ON public.whatsapp_messages;
CREATE TRIGGER mirror_whatsapp_to_omnichannel_upd
  AFTER UPDATE ON public.whatsapp_messages
  FOR EACH ROW
  WHEN (OLD.message_text IS DISTINCT FROM NEW.message_text
     OR OLD.media_url    IS DISTINCT FROM NEW.media_url
     OR OLD.metadata     IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION public.mirror_whatsapp_to_omnichannel();
```

## Confirmação

- ✅ **UPDATE espelha de verdade**: agora propaga `content_text`, `media_url` E `metadata` na row correspondente de `messages` via `(source_table, source_id)`. Sem efeito colateral em conversation, contadores ou timestamps.
- ✅ **Timestamps null-safe explícitos**: `CASE` cobre os 4 cenários (ambos NULL, só atual, só novo, ambos preenchidos) sem depender do comportamento implícito de `GREATEST`. Funciona com inserts fora de ordem (sempre o maior vence) e backfill.
- ✅ **Não-destrutivo**: `whatsapp_messages` intacta; mudança apenas em função + trigger novos.
- ✅ **Sem ampliar escopo**: zero mudança em UI, canais Meta, edge functions ou n8n.
- ✅ **Idempotente**: nova migration é `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — segura para reaplicar.

## Arquivo a criar

Uma migração nova (não edita a anterior — preserva histórico):
- `supabase/migrations/<ts>_omnichannel_mirror_fixes.sql` contendo apenas:
  - `CREATE OR REPLACE FUNCTION public.mirror_whatsapp_to_omnichannel()` versão corrigida completa
  - Recriação do trigger UPDATE com `metadata` no `WHEN`

Sem tocar em tabelas, RLS, enums, backfill ou camada TypeScript — todos permanecem como estão.

