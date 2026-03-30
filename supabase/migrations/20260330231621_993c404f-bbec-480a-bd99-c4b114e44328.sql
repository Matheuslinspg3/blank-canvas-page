
-- Add transfer fields to whatsapp_agent_config
ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS transfer_phone text,
  ADD COLUMN IF NOT EXISTS transfer_message text DEFAULT 'Olá! Um cliente precisa de atendimento humano. Segue o contexto da conversa:';

-- Create whatsapp_messages table for chat panel
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  remote_jid text NOT NULL,
  from_me boolean NOT NULL DEFAULT false,
  message_text text,
  message_type text DEFAULT 'text',
  message_id text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_org ON public.whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_jid ON public.whatsapp_messages(organization_id, remote_jid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_msgid ON public.whatsapp_messages(message_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their org messages"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Service role insert policy for edge functions / webhooks
CREATE POLICY "Service role full access"
  ON public.whatsapp_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
