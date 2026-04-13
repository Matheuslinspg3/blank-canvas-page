
CREATE TABLE public.retell_flow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'conversation',
  label TEXT NOT NULL,
  instruction_text TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  edges JSONB DEFAULT '[]'::jsonb,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, node_id)
);

ALTER TABLE public.retell_flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view flow steps"
  ON public.retell_flow_steps FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage flow steps"
  ON public.retell_flow_steps FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER update_retell_flow_steps_updated_at
  BEFORE UPDATE ON public.retell_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
