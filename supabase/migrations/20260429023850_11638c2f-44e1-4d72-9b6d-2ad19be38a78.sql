CREATE OR REPLACE FUNCTION public.get_public_redirect_for_hostname(p_hostname text)
RETURNS TABLE(redirect_to text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_platform_suffix text := '.portadocorretor.com.br';
  v_slug text;
  v_should_redirect boolean := false;
  v_custom_host text;
BEGIN
  IF p_hostname IS NULL OR length(p_hostname) = 0 THEN
    RETURN;
  END IF;

  -- Resolve org by platform subdomain or by custom domain
  IF right(p_hostname, length(v_platform_suffix)) = v_platform_suffix THEN
    v_slug := left(p_hostname, length(p_hostname) - length(v_platform_suffix));
    IF v_slug = '' OR position('.' in v_slug) > 0 THEN
      RETURN;
    END IF;
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = v_slug LIMIT 1;
  ELSE
    SELECT organization_id INTO v_org_id
    FROM public.tenant_domains
    WHERE hostname = p_hostname AND is_active = true
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Only redirect when accessed via the platform subdomain (not when already on custom)
  IF right(p_hostname, length(v_platform_suffix)) <> v_platform_suffix THEN
    RETURN;
  END IF;

  SELECT COALESCE(redirect_to_custom_domain, false)
    INTO v_should_redirect
  FROM public.website_settings
  WHERE organization_id = v_org_id
  LIMIT 1;

  IF NOT v_should_redirect THEN
    RETURN;
  END IF;

  SELECT hostname INTO v_custom_host
  FROM public.tenant_domains
  WHERE organization_id = v_org_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_custom_host IS NULL OR v_custom_host = p_hostname THEN
    RETURN;
  END IF;

  redirect_to := v_custom_host;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_redirect_for_hostname(text) TO anon, authenticated;