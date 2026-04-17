CREATE OR REPLACE FUNCTION public.get_property_id_by_org_code(p_org_slug text, p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM properties p
  JOIN organizations o ON o.id = p.organization_id
  WHERE o.slug = p_org_slug
    AND p.property_code = p_code
    AND p.status = 'disponivel'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_id_by_org_code(text, text) TO anon, authenticated;