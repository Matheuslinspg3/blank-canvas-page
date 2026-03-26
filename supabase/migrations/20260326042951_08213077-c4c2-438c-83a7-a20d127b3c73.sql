
-- Add inactivation tracking columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inactivation_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inactivated_by text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inactivated_at timestamptz;
