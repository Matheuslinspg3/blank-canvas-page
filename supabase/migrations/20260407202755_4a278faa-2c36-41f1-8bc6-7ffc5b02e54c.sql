ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS use_subdomain_landing boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.website_settings.use_subdomain_landing IS 'When true and site is active, landing page URLs use the subdomain format (slug.portadocorretor.com.br/imovel/xxx). When false, uses default path (/imovel/xxx).';