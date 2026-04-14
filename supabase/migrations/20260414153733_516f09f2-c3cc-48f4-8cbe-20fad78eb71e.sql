ALTER TABLE public.ai_qualification_config
  ADD COLUMN default_lead_stage_id UUID REFERENCES public.lead_stages(id) ON DELETE SET NULL DEFAULT NULL;