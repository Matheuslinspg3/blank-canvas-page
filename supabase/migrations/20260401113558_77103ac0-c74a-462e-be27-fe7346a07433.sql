
-- Trigger function: auto-sync follow_up_queue on new whatsapp_messages
CREATE OR REPLACE FUNCTION public.trg_whatsapp_msg_followup_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_me = false THEN
    -- Inbound message: mark as responded
    UPDATE follow_up_queue
    SET status = 'responded',
        last_inbound_at = NEW.timestamp,
        updated_at = now()
    WHERE org_id = NEW.organization_id
      AND lead_phone = NEW.remote_jid
      AND status IN ('pending', 'sent');
  ELSE
    -- Outbound message: update last outbound timestamp
    UPDATE follow_up_queue
    SET last_outbound_at = NEW.timestamp,
        updated_at = now()
    WHERE org_id = NEW.organization_id
      AND lead_phone = NEW.remote_jid
      AND status IN ('pending', 'sent');
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to whatsapp_messages
DROP TRIGGER IF EXISTS trg_followup_sync ON public.whatsapp_messages;
CREATE TRIGGER trg_followup_sync
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_whatsapp_msg_followup_sync();
