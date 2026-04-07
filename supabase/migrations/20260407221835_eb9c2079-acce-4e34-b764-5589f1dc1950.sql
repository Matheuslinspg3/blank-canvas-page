CREATE OR REPLACE FUNCTION public.get_public_org_by_slug(p_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  LEFT JOIN public.website_settings ws
    ON ws.organization_id = o.id
  WHERE lower(o.slug) = lower(p_slug)
    AND COALESCE(ws.is_active, true) = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_org_by_id(p_org_id uuid)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  LEFT JOIN public.website_settings ws
    ON ws.organization_id = o.id
  WHERE o.id = p_org_id
    AND COALESCE(ws.is_active, true) = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_brand_settings(p_org_id uuid)
RETURNS TABLE(
  primary_color text,
  secondary_color text,
  accent_color text,
  font_family text,
  slogan text,
  tagline text,
  logo_url text,
  logo_dark_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bs.primary_color,
    bs.secondary_color,
    bs.accent_color,
    bs.font_family,
    bs.slogan,
    bs.tagline,
    bs.logo_url,
    bs.logo_dark_url
  FROM public.brand_settings bs
  LEFT JOIN public.website_settings ws
    ON ws.organization_id = bs.organization_id
  WHERE bs.organization_id = p_org_id
    AND COALESCE(ws.is_active, true) = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_domain(p_hostname text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('organization_id', td.organization_id)
  FROM public.tenant_domains td
  LEFT JOIN public.website_settings ws
    ON ws.organization_id = td.organization_id
  WHERE lower(td.hostname) = lower(p_hostname)
    AND td.is_active = true
    AND COALESCE(ws.is_active, true) = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_tenant_redirect(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'redirect_to_custom_domain', COALESCE(
      (
        SELECT ws.redirect_to_custom_domain
        FROM public.website_settings ws
        WHERE ws.organization_id = p_org_id
        LIMIT 1
      ),
      false
    ),
    'custom_hostname', (
      SELECT td.hostname
      FROM public.tenant_domains td
      WHERE td.organization_id = p_org_id
        AND td.is_active = true
      LIMIT 1
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_public_org_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_org_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_brand_settings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_domain(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_redirect(uuid) TO anon, authenticated;