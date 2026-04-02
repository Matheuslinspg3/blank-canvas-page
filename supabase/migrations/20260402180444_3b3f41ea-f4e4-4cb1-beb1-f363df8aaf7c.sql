
-- Automations table (persistent rules)
CREATE TABLE public.automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER set_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_automations_org ON public.automations(organization_id);
CREATE INDEX idx_automations_enabled ON public.automations(organization_id, enabled);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org automations"
  ON public.automations FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org automations"
  ON public.automations FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own org automations"
  ON public.automations FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete own org automations"
  ON public.automations FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Execution logs table
CREATE TABLE public.automation_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  automation_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  lead_name TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_executions_org ON public.automation_executions(organization_id);
CREATE INDEX idx_executions_automation ON public.automation_executions(automation_id);
CREATE INDEX idx_executions_time ON public.automation_executions(executed_at DESC);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org executions"
  ON public.automation_executions FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role full access executions"
  ON public.automation_executions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
