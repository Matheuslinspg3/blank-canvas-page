
-- Table to track welcome message sends and responses
CREATE TABLE public.whatsapp_welcome_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone text NOT NULL,
  welcome_message_id uuid REFERENCES public.whatsapp_welcome_messages(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response_count int NOT NULL DEFAULT 0,
  had_dialogue boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups by org + phone
CREATE INDEX idx_welcome_log_org_phone ON public.whatsapp_welcome_log(organization_id, phone);
CREATE INDEX idx_welcome_log_sent_at ON public.whatsapp_welcome_log(sent_at DESC);

-- RLS
ALTER TABLE public.whatsapp_welcome_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view welcome logs"
ON public.whatsapp_welcome_log
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Service role can do everything (edge functions use service key)
CREATE POLICY "Service role full access on welcome log"
ON public.whatsapp_welcome_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger: update welcome log when inbound message arrives
CREATE OR REPLACE FUNCTION public.update_welcome_log_on_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process inbound messages
  IF NEW.from_me = false THEN
    UPDATE public.whatsapp_welcome_log
    SET
      responded_at = COALESCE(responded_at, now()),
      response_count = response_count + 1,
      had_dialogue = CASE WHEN response_count >= 1 THEN true ELSE false END,
      last_activity_at = now()
    WHERE organization_id = NEW.organization_id
      AND phone = NEW.phone
      AND sent_at = (
        SELECT MAX(wl.sent_at)
        FROM public.whatsapp_welcome_log wl
        WHERE wl.organization_id = NEW.organization_id
          AND wl.phone = NEW.phone
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_welcome_log
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_welcome_log_on_response();
