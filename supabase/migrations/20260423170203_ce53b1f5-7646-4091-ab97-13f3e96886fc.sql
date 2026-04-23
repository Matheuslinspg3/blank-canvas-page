
-- 1. broker_message_templates
CREATE TABLE public.broker_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'personalizado'
    CHECK (category IN ('saudacao', 'followup', 'reativacao', 'pos_visita', 'pos_proposta', 'personalizado')),
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_templates_select" ON public.broker_message_templates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id = public.get_user_organization_id());

CREATE POLICY "broker_templates_insert" ON public.broker_message_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = public.get_user_organization_id());

CREATE POLICY "broker_templates_update" ON public.broker_message_templates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(auth.uid()));

CREATE POLICY "broker_templates_delete" ON public.broker_message_templates
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(auth.uid()));

CREATE TRIGGER update_broker_message_templates_updated_at
  BEFORE UPDATE ON public.broker_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_broker_templates_user ON public.broker_message_templates(user_id, category);
CREATE INDEX idx_broker_templates_org ON public.broker_message_templates(organization_id);

-- 2. Add automation config columns to broker_whatsapp_channels
ALTER TABLE public.broker_whatsapp_channels
  ADD COLUMN IF NOT EXISTS greeting_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS greeting_template_id uuid REFERENCES public.broker_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_intervals jsonb NOT NULL DEFAULT '[24, 48, 72]',
  ADD COLUMN IF NOT EXISTS followup_max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS followup_business_hours jsonb NOT NULL DEFAULT '{"start": "08:00", "end": "18:00"}';

-- 3. Expand follow_up_queue for broker channels
ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS broker_channel_id uuid REFERENCES public.broker_whatsapp_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broker_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop the old unique constraint and create a new one that includes channel_type
ALTER TABLE public.follow_up_queue DROP CONSTRAINT IF EXISTS follow_up_queue_org_id_lead_phone_key;
ALTER TABLE public.follow_up_queue ADD CONSTRAINT follow_up_queue_org_phone_channel_key UNIQUE (org_id, lead_phone, channel_type);

CREATE INDEX IF NOT EXISTS idx_followup_channel_type ON public.follow_up_queue(channel_type);
CREATE INDEX IF NOT EXISTS idx_followup_broker_channel ON public.follow_up_queue(broker_channel_id) WHERE broker_channel_id IS NOT NULL;

-- 4. Update the followup sync trigger to be channel_type aware
CREATE OR REPLACE FUNCTION public.trg_whatsapp_msg_followup_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_me = false THEN
    UPDATE follow_up_queue
    SET status = 'responded',
        last_inbound_at = NEW.timestamp,
        updated_at = now()
    WHERE org_id = NEW.organization_id
      AND lead_phone = NEW.remote_jid
      AND channel_type = COALESCE(NEW.channel_type, 'org')
      AND status IN ('pending', 'sent');
  ELSE
    UPDATE follow_up_queue
    SET last_outbound_at = NEW.timestamp,
        updated_at = now()
    WHERE org_id = NEW.organization_id
      AND lead_phone = NEW.remote_jid
      AND channel_type = COALESCE(NEW.channel_type, 'org')
      AND status IN ('pending', 'sent');
  END IF;

  RETURN NEW;
END;
$$;
