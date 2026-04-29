CREATE OR REPLACE FUNCTION public.get_property_id_by_org_id_code(p_org_id uuid, p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.properties
  WHERE organization_id = p_org_id
    AND property_code = p_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_property_id_by_org_id_code(uuid, text) TO anon, authenticated;