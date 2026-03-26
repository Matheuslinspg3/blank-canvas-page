
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_tone') THEN
    CREATE TYPE public.agent_tone AS ENUM ('formal', 'informal', 'tecnico');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_rule_type') THEN
    CREATE TYPE public.property_rule_type AS ENUM ('whitelist', 'blacklist', 'highlight');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_name text NOT NULL DEFAULT 'Valentina',
  tone agent_tone NOT NULL DEFAULT 'informal',
  system_prompt text DEFAULT '',
  is_property_db_enabled boolean NOT NULL DEFAULT false,
  auto_qualify_leads boolean NOT NULL DEFAULT false,
  auto_create_leads boolean NOT NULL DEFAULT false,
  schedule_visits boolean NOT NULL DEFAULT false,
  working_hours_start time DEFAULT '08:00',
  working_hours_end time DEFAULT '18:00',
  welcome_message text DEFAULT 'Olá! Sou a Valentina, assistente virtual. Como posso ajudar?',
  away_message text DEFAULT 'No momento estamos fora do horário de atendimento. Retornaremos em breve!',
  transfer_keywords text[] DEFAULT ARRAY['falar com corretor', 'atendente', 'humano', 'reclamação'],
  max_messages_before_transfer integer NOT NULL DEFAULT 10,
  broker_assignment_mode text NOT NULL DEFAULT 'manual',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_property_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rule_type property_rule_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, property_id, rule_type)
);

ALTER TABLE public.whatsapp_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_property_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_agent_config' AND policyname = 'Users can view own org config') THEN
    CREATE POLICY "Users can view own org config" ON public.whatsapp_agent_config FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_agent_config' AND policyname = 'Managers can update own org config') THEN
    CREATE POLICY "Managers can update own org config" ON public.whatsapp_agent_config FOR UPDATE TO authenticated USING (public.is_org_manager_or_above(auth.uid())) WITH CHECK (organization_id = public.get_user_organization_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_agent_config' AND policyname = 'Managers can insert own org config') THEN
    CREATE POLICY "Managers can insert own org config" ON public.whatsapp_agent_config FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_property_rules' AND policyname = 'Users can view own org rules') THEN
    CREATE POLICY "Users can view own org rules" ON public.whatsapp_property_rules FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_property_rules' AND policyname = 'Managers can insert own org rules') THEN
    CREATE POLICY "Managers can insert own org rules" ON public.whatsapp_property_rules FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_property_rules' AND policyname = 'Managers can delete own org rules') THEN
    CREATE POLICY "Managers can delete own org rules" ON public.whatsapp_property_rules FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_whatsapp_agent_config_updated_at ON public.whatsapp_agent_config;
CREATE TRIGGER set_whatsapp_agent_config_updated_at
  BEFORE UPDATE ON public.whatsapp_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
