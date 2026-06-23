
CREATE OR REPLACE FUNCTION public.debug_properties_visibility()
RETURNS TABLE (
  property_id uuid, code text, title text, organization_id uuid, organization_name text,
  status text, marketplace_active boolean, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.property_code, p.title, p.organization_id, o.name, p.status::text,
         (m.id IS NOT NULL), p.updated_at
  FROM public.properties p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  LEFT JOIN public.marketplace_properties m ON m.id = p.id
  WHERE public.has_role(auth.uid(), 'developer'::public.app_role)
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 2000;
$$;
REVOKE ALL ON FUNCTION public.debug_properties_visibility() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_properties_visibility() TO authenticated;

CREATE OR REPLACE FUNCTION public.debug_amenities_overview()
RETURNS TABLE (
  amenity_id uuid, name text, category text, is_default boolean,
  organization_id uuid, organization_name text, is_global boolean, duplicates_global boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH globals AS (
    SELECT lower(name) AS lname FROM public.property_amenities WHERE organization_id IS NULL
  )
  SELECT a.id, a.name, a.category, a.is_default, a.organization_id, o.name,
         (a.organization_id IS NULL),
         (a.organization_id IS NOT NULL AND lower(a.name) IN (SELECT lname FROM globals))
  FROM public.property_amenities a
  LEFT JOIN public.organizations o ON o.id = a.organization_id
  WHERE public.has_role(auth.uid(), 'developer'::public.app_role)
  ORDER BY (a.organization_id IS NULL) DESC, o.name NULLS FIRST, a.category, a.name;
$$;
REVOKE ALL ON FUNCTION public.debug_amenities_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_amenities_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.debug_invites_overview()
RETURNS TABLE (
  invite_id uuid, email text, role text, status text, expires_at timestamptz, created_at timestamptz,
  organization_id uuid, organization_name text, user_already_exists boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.email, i.role::text, i.status::text, i.expires_at, i.created_at,
         i.organization_id, o.name,
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(i.email))
  FROM public.organization_invites i
  LEFT JOIN public.organizations o ON o.id = i.organization_id
  WHERE public.has_role(auth.uid(), 'developer'::public.app_role)
  ORDER BY i.created_at DESC
  LIMIT 1000;
$$;
REVOKE ALL ON FUNCTION public.debug_invites_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_invites_overview() TO authenticated;
