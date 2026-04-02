-- Recreate get_marketplace_contact to return org + broker data with fallbacks
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
    'org_phone', COALESCE(o.phone, mp.owner_phone),
    'org_email', COALESCE(o.email, mp.owner_email),
    'org_logo', o.logo_url,
    'broker_name', pr.full_name,
    'broker_phone', COALESCE(pr.phone, mp.owner_phone),
    'broker_avatar', pr.avatar_url,
    'owner_name', mp.owner_name,
    'owner_phone', mp.owner_phone
  ) INTO result
  FROM marketplace_properties mp
  LEFT JOIN organizations o ON o.id = mp.organization_id
  LEFT JOIN properties p ON p.id = mp.id
  LEFT JOIN profiles pr ON pr.user_id = p.created_by
  WHERE mp.id = p_property_id;

  RETURN result;
END;
$$;