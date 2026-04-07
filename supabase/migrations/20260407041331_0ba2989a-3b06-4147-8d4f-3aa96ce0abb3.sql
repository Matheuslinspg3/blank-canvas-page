ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS cloudflare_zone_id text,
  ADD COLUMN IF NOT EXISTS zone_mode text NOT NULL DEFAULT 'custom_hostname',
  ADD COLUMN IF NOT EXISTS nameservers text[],
  ADD COLUMN IF NOT EXISTS zone_status text;