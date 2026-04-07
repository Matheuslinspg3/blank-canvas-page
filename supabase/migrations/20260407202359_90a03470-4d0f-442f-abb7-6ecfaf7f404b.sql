CREATE OR REPLACE FUNCTION public.get_public_org_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  INNER JOIN public.website_settings ws
    ON ws.organization_id = o.id
   AND ws.is_active = true
  WHERE o.slug = p_slug
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_org_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_org_by_id(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  INNER JOIN public.website_settings ws
    ON ws.organization_id = o.id
   AND ws.is_active = true
  WHERE o.id = p_org_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_org_by_id(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_brand_settings(p_org_id uuid)
RETURNS TABLE (
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
  INNER JOIN public.website_settings ws
    ON ws.organization_id = bs.organization_id
   AND ws.is_active = true
  WHERE bs.organization_id = p_org_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_brand_settings(uuid) TO anon, authenticated;