-- Create follow_up_queue table
CREATE TABLE public.follow_up_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_phone TEXT NOT NULL,
  lead_name TEXT,
  property_interest TEXT,
  conversation_context TEXT,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'completed', 'opted_out')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_followup_at TIMESTAMPTZ NOT NULL,
  last_outbound_at TIMESTAMPTZ DEFAULT now(),
  last_inbound_at TIMESTAMPTZ,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, lead_phone)
);

-- Indexes
CREATE INDEX idx_followup_pending_due 
  ON public.follow_up_queue (next_followup_at) 
  WHERE status = 'pending' AND opted_out = false;

CREATE INDEX idx_followup_org_phone 
  ON public.follow_up_queue (org_id, lead_phone);

CREATE INDEX idx_followup_status 
  ON public.follow_up_queue (status);

-- Auto updated_at trigger
CREATE TRIGGER set_followup_updated_at
  BEFORE UPDATE ON public.follow_up_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.follow_up_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org followups"
  ON public.follow_up_queue FOR SELECT TO authenticated
  USING (org_id = public.get_user_organization_id());

CREATE POLICY "Service role full access"
  ON public.follow_up_queue FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add followup columns to whatsapp_agent_config
ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_intervals JSONB NOT NULL DEFAULT '[24, 48, 72]';

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_max_attempts INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_business_hours JSONB NOT NULL DEFAULT '{"start": "08:00", "end": "18:00"}';

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_template_1 TEXT NOT NULL DEFAULT 'Oi {nome}! Vi que você se interessou por um imóvel. Posso te ajudar com mais informações? 😊';

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_template_3 TEXT NOT NULL DEFAULT 'Última mensagem, {nome}! Se precisar de algo sobre imóveis, estamos aqui. 😊';

ALTER TABLE public.whatsapp_agent_config ADD COLUMN IF NOT EXISTS
  followup_ai_prompt TEXT NOT NULL DEFAULT 'Gere uma mensagem de follow-up personalizada e curta para o lead {nome} que demonstrou interesse em {imovel}. Contexto da conversa: {contexto}. Seja natural e não pressione. Máximo 2 frases.';