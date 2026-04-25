CREATE TABLE IF NOT EXISTS public.whatsapp_broker_send_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  broker_channel_id uuid NOT NULL,
  remote_jid text NOT NULL,
  client_message_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_channel_id, client_message_id)
);

ALTER TABLE public.whatsapp_broker_send_locks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_whatsapp_broker_send_locks_channel_created
ON public.whatsapp_broker_send_locks (broker_channel_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_whatsapp_broker_send_locks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_whatsapp_broker_send_locks_updated_at ON public.whatsapp_broker_send_locks;
CREATE TRIGGER trg_touch_whatsapp_broker_send_locks_updated_at
BEFORE UPDATE ON public.whatsapp_broker_send_locks
FOR EACH ROW
EXECUTE FUNCTION public.touch_whatsapp_broker_send_locks_updated_at();