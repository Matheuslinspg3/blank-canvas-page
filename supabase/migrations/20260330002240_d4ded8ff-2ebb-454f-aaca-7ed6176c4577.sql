-- Fix ai_router_providers_safe view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.ai_router_providers_safe;
CREATE VIEW public.ai_router_providers_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  provider_key,
  display_name,
  provider_type,
  model_id,
  api_base_url,
  is_free,
  is_active,
  priority,
  supports_image_input,
  supports_image_output,
  rate_limit_rpm,
  rate_limit_rpd,
  last_error_at,
  consecutive_errors,
  notes,
  created_at,
  env_secret_name,
  ((api_key IS NOT NULL) AND (length(api_key) > 0)) AS has_api_key
FROM public.ai_router_providers;

GRANT SELECT ON public.ai_router_providers_safe TO authenticated;
REVOKE ALL ON public.ai_router_providers_safe FROM anon;
