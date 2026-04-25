ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS push_name text;

CREATE INDEX IF NOT EXISTS idx_wa_messages_broker_jid_ts
  ON public.whatsapp_messages (broker_channel_id, remote_jid, "timestamp" DESC)
  WHERE broker_channel_id IS NOT NULL;