-- Add instance management columns to whatsapp_agent_config
ALTER TABLE public.whatsapp_agent_config 
  ADD COLUMN IF NOT EXISTS instance_token text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS webhook_url text;

-- Migrate existing data from whatsapp_instances to whatsapp_agent_config
UPDATE public.whatsapp_agent_config wac
SET 
  instance_name = wi.instance_name,
  instance_token = wi.instance_token,
  status = wi.status,
  phone_number = wi.phone_number,
  qr_code = wi.qr_code,
  webhook_url = wi.webhook_url
FROM public.whatsapp_instances wi
WHERE wi.organization_id = wac.organization_id;

-- Insert agent configs for orgs that have instances but no agent config yet
INSERT INTO public.whatsapp_agent_config (organization_id, instance_name, instance_token, status, phone_number, qr_code, webhook_url)
SELECT wi.organization_id, wi.instance_name, wi.instance_token, wi.status, wi.phone_number, wi.qr_code, wi.webhook_url
FROM public.whatsapp_instances wi
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_agent_config wac WHERE wac.organization_id = wi.organization_id
);