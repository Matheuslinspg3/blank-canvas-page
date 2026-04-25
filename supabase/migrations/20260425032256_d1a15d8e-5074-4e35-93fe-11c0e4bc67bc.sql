UPDATE public.whatsapp_messages AS target
SET push_name = source.latest_push_name
FROM (
  SELECT DISTINCT ON (broker_channel_id, remote_jid)
    broker_channel_id,
    remote_jid,
    push_name AS latest_push_name
  FROM public.whatsapp_messages
  WHERE broker_channel_id IS NOT NULL
    AND push_name IS NOT NULL
    AND btrim(push_name) <> ''
  ORDER BY broker_channel_id, remote_jid, timestamp DESC
) AS source
WHERE target.broker_channel_id = source.broker_channel_id
  AND target.remote_jid = source.remote_jid
  AND target.broker_channel_id IS NOT NULL
  AND target.from_me = true
  AND target.push_name IS NULL;