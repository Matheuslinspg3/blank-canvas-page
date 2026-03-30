-- Fix the get_marketplace_contact function to show organization contact only
CREATE OR REPLACE FUNCTION public.get_marketplace_contact(p_property_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'org_name', o.name,
    'org_phone', o.phone,
    'org_email', o.email
  ) INTO result
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  WHERE mp.id = p_property_id;

  RETURN result;
END;
$$;