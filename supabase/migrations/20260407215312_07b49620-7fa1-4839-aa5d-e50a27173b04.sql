-- RPC to resolve tenant domain for anonymous visitors
CREATE OR REPLACE FUNCTION public.get_public_tenant_by_domain(p_hostname text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('organization_id', td.organization_id)
  FROM tenant_domains td
  JOIN website_settings ws ON ws.organization_id = td.organization_id
  WHERE td.hostname = p_hostname
    AND td.is_active = true
    AND ws.is_active = true
  LIMIT 1;
$$;

-- RPC to check redirect settings for anonymous visitors
CREATE OR REPLACE FUNCTION public.get_public_tenant_redirect(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'redirect_to_custom_domain', COALESCE(ws.redirect_to_custom_domain, false),
    'custom_hostname', (
      SELECT td.hostname 
      FROM tenant_domains td 
      WHERE td.organization_id = p_org_id 
        AND td.is_active = true 
      LIMIT 1
    )
  )
  FROM website_settings ws
  WHERE ws.organization_id = p_org_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_domain(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_redirect(uuid) TO anon, authenticated;