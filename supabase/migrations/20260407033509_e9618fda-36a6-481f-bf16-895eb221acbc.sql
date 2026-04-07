ALTER TABLE public.website_settings
  ADD COLUMN redirect_to_custom_domain boolean NOT NULL DEFAULT false,
  ADD COLUMN use_custom_domain_url boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.website_settings.redirect_to_custom_domain IS 'When true, visitors on the default subdomain are redirected to the custom domain';
COMMENT ON COLUMN public.website_settings.use_custom_domain_url IS 'When true, public URLs use the custom domain instead of the default .portadocorretor.com.br subdomain';