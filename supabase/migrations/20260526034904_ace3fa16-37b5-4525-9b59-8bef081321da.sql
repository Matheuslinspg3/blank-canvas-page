ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS crm_new_lead_stage_id uuid REFERENCES public.lead_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_qualified_stage_id uuid REFERENCES public.lead_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_auto_advance_on_qualified boolean NOT NULL DEFAULT true;