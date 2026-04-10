-- Table for welcome messages
CREATE TABLE public.whatsapp_welcome_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_welcome_msgs_org ON public.whatsapp_welcome_messages(organization_id, position);

ALTER TABLE public.whatsapp_welcome_messages ENABLE ROW LEVEL SECURITY;

-- RLS: org members only
CREATE POLICY "Org members can view welcome messages"
  ON public.whatsapp_welcome_messages FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can insert welcome messages"
  ON public.whatsapp_welcome_messages FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can update welcome messages"
  ON public.whatsapp_welcome_messages FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can delete welcome messages"
  ON public.whatsapp_welcome_messages FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Track next welcome index on agent config
ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS welcome_next_index INTEGER NOT NULL DEFAULT 0;

-- Updated_at trigger
CREATE TRIGGER update_welcome_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_welcome_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();