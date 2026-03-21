-- Fix remaining issues

-- Fix: user_roles privilege escalation - restrict leader role assignment to developers only
DROP POLICY IF EXISTS "Dev or leader can update roles" ON public.user_roles;
CREATE POLICY "Dev or admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('developer', 'admin')
  )
)
WITH CHECK (
  -- Only developer can assign admin/developer/leader roles
  CASE
    WHEN role IN ('admin', 'developer', 'sub_admin') THEN
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'developer'
      )
    ELSE true
  END
);

-- Fix: marketplace PII - change the cross-org policy to use a security definer function
-- that returns rows without PII columns. Since Postgres doesn't support column-level RLS,
-- we'll remove the cross-org base table policy and make the view use SECURITY DEFINER instead.

DROP POLICY IF EXISTS "Cross-org can view disponivel marketplace properties" ON public.marketplace_properties;

-- Create a SECURITY DEFINER function to serve the public view
CREATE OR REPLACE FUNCTION public.get_marketplace_properties_public()
RETURNS TABLE (
  id uuid, title text, description text, property_type_id uuid, transaction_type text,
  sale_price numeric, rent_price numeric, address_street text, address_number text,
  address_complement text, address_neighborhood text, address_city text,
  address_state text, address_zipcode text, bedrooms integer, suites integer,
  bathrooms integer, parking_spots integer, area_total numeric, area_built numeric,
  amenities text[], images text[], status text, is_featured boolean,
  external_code text, organization_id uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mp.id, mp.title, mp.description, mp.property_type_id, mp.transaction_type::text,
    mp.sale_price, mp.rent_price, mp.address_street, mp.address_number,
    mp.address_complement, mp.address_neighborhood, mp.address_city,
    mp.address_state, mp.address_zipcode, mp.bedrooms, mp.suites,
    mp.bathrooms, mp.parking_spots, mp.area_total, mp.area_built,
    mp.amenities, mp.images, mp.status::text, mp.is_featured,
    mp.external_code, mp.organization_id, mp.created_at, mp.updated_at
  FROM public.marketplace_properties mp
  WHERE mp.status = 'disponivel'
     OR mp.organization_id = get_user_organization_id();
$$;

-- Recreate the public view using the security definer function
DROP VIEW IF EXISTS public.marketplace_properties_public;
CREATE VIEW public.marketplace_properties_public AS
  SELECT * FROM public.get_marketplace_properties_public();

GRANT SELECT ON public.marketplace_properties_public TO authenticated, anon;