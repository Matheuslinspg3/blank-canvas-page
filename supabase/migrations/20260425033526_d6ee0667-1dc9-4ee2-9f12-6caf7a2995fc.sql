DROP FUNCTION IF EXISTS public.reprocess_broker_whatsapp_contact_names();

CREATE OR REPLACE FUNCTION public.reprocess_broker_whatsapp_contact_names(p_broker_channel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.broker_whatsapp_channels bwc
    WHERE bwc.id = p_broker_channel_id
      AND bwc.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH latest_names AS (
    SELECT DISTINCT ON (wm.broker_channel_id, wm.remote_jid)
      wm.broker_channel_id,
      wm.remote_jid,
      btrim(wm.push_name) AS contact_name
    FROM public.whatsapp_messages wm
    WHERE wm.broker_channel_id = p_broker_channel_id
      AND wm.push_name IS NOT NULL
      AND btrim(wm.push_name) <> ''
    ORDER BY wm.broker_channel_id, wm.remote_jid, wm.timestamp DESC
  ), updated_rows AS (
    UPDATE public.whatsapp_messages target
    SET push_name = latest_names.contact_name
    FROM latest_names
    WHERE target.broker_channel_id = latest_names.broker_channel_id
      AND target.remote_jid = latest_names.remote_jid
      AND target.broker_channel_id = p_broker_channel_id
      AND (target.push_name IS NULL OR btrim(target.push_name) = '')
    RETURNING target.id
  )
  SELECT count(*) INTO v_updated FROM updated_rows;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.reprocess_broker_whatsapp_contact_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_broker_whatsapp_contact_names(uuid) TO authenticated;