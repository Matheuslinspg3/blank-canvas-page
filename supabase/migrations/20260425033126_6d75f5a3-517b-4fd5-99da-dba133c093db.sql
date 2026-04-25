ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS client_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_broker_client_message_id
ON public.whatsapp_messages (broker_channel_id, client_message_id)
WHERE broker_channel_id IS NOT NULL AND client_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reprocess_broker_whatsapp_contact_names()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH latest_names AS (
    SELECT DISTINCT ON (wm.broker_channel_id, wm.remote_jid)
      wm.broker_channel_id,
      wm.remote_jid,
      btrim(wm.push_name) AS contact_name
    FROM public.whatsapp_messages wm
    WHERE wm.broker_channel_id IS NOT NULL
      AND wm.push_name IS NOT NULL
      AND btrim(wm.push_name) <> ''
    ORDER BY wm.broker_channel_id, wm.remote_jid, wm.timestamp DESC
  ), updated_rows AS (
    UPDATE public.whatsapp_messages target
    SET push_name = latest_names.contact_name
    FROM latest_names
    WHERE target.broker_channel_id = latest_names.broker_channel_id
      AND target.remote_jid = latest_names.remote_jid
      AND target.broker_channel_id IS NOT NULL
      AND (target.push_name IS NULL OR btrim(target.push_name) = '')
    RETURNING target.id
  )
  SELECT count(*) INTO v_updated FROM updated_rows;

  RETURN v_updated;
END;
$$;

SELECT public.reprocess_broker_whatsapp_contact_names();