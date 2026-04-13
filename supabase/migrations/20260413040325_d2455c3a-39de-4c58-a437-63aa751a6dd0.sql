
-- =============================================
-- Table: retell_agent_config (one per org)
-- =============================================
CREATE TABLE public.retell_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL DEFAULT '',
  agent_name TEXT NOT NULL DEFAULT 'Agente de Voz',
  qualification_prompt TEXT DEFAULT '',
  transfer_keywords TEXT[] DEFAULT ARRAY['falar com corretor', 'atendente', 'humano']::TEXT[],
  max_call_duration_min INTEGER DEFAULT 15,
  working_hours_start TEXT DEFAULT '08:00',
  working_hours_end TEXT DEFAULT '18:00',
  auto_qualify_leads BOOLEAN DEFAULT false,
  auto_create_leads BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.retell_agent_config ENABLE ROW LEVEL SECURITY;

-- Members can view their org config
CREATE POLICY "Members can view retell config"
  ON public.retell_agent_config FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Admins/subadmins/devs can manage config
CREATE POLICY "Admins can manage retell config"
  ON public.retell_agent_config FOR ALL
  TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Updated_at trigger
CREATE TRIGGER update_retell_agent_config_updated_at
  BEFORE UPDATE ON public.retell_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Table: voice_calls
-- =============================================
CREATE TABLE public.voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  call_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  call_type TEXT DEFAULT 'web_call',
  call_status TEXT DEFAULT 'registered',
  duration_ms INTEGER,
  transcript TEXT,
  recording_url TEXT,
  sentiment TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

-- Members can view their org calls
CREATE POLICY "Members can view voice calls"
  ON public.voice_calls FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Service role inserts (webhook), admins can also insert
CREATE POLICY "Authenticated can insert voice calls"
  ON public.voice_calls FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Index for performance
CREATE INDEX idx_voice_calls_org_id ON public.voice_calls(organization_id);
CREATE INDEX idx_voice_calls_call_id ON public.voice_calls(call_id);
CREATE INDEX idx_voice_calls_lead_id ON public.voice_calls(lead_id);
