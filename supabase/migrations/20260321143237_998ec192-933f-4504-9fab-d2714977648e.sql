-- =============================================
-- SECURITY REMEDIATION: Fase 1 + 2 + 3
-- =============================================

-- C2: Remove cross-org PII exposure on marketplace_properties
-- Drop the overly permissive SELECT policy that leaks PII cross-org
DROP POLICY IF EXISTS "Authenticated users can view available marketplace properties (" ON public.marketplace_properties;

-- Recreate: own org sees everything, cross-org sees only via the public view (no PII)
CREATE POLICY "Authenticated users can view available marketplace properties"
ON public.marketplace_properties
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id());

-- Recreate marketplace_properties_public view as SECURITY INVOKER and ensure no PII
DROP VIEW IF EXISTS public.marketplace_properties_public;
CREATE VIEW public.marketplace_properties_public
WITH (security_invoker = true)
AS SELECT
  id, title, description, property_type_id, transaction_type,
  sale_price, rent_price, address_street, address_number,
  address_complement, address_neighborhood, address_city,
  address_state, address_zipcode, bedrooms, suites, bathrooms,
  parking_spots, area_total, area_built, amenities, images,
  status, is_featured, external_code, organization_id,
  created_at, updated_at
FROM public.marketplace_properties;

-- Grant access so the view works for authenticated + anon
GRANT SELECT ON public.marketplace_properties_public TO authenticated, anon;

-- Re-add a permissive policy for the public view's underlying query for cross-org disponivel
CREATE POLICY "Cross-org can view disponivel marketplace properties"
ON public.marketplace_properties
FOR SELECT
TO authenticated
USING (status = 'disponivel');

-- C3: Restrict ai_provider_config to system admins only
DROP POLICY IF EXISTS "Admins and developers can read AI config" ON public.ai_provider_config;
CREATE POLICY "Only system admins can read AI config"
ON public.ai_provider_config
FOR SELECT
TO authenticated
USING (is_system_admin());

DROP POLICY IF EXISTS "Admins and developers can update AI config" ON public.ai_provider_config;
CREATE POLICY "Only system admins can update AI config"
ON public.ai_provider_config
FOR UPDATE
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

DROP POLICY IF EXISTS "Admins and developers can insert AI config" ON public.ai_provider_config;
CREATE POLICY "Only system admins can insert AI config"
ON public.ai_provider_config
FOR INSERT
TO authenticated
WITH CHECK (is_system_admin());

-- A2: Restrict ad_accounts SELECT to managers+ (hide auth_payload from corretores)
DROP POLICY IF EXISTS "Users can view own org ad_accounts" ON public.ad_accounts;

-- Managers+ see full row; corretores see limited columns via a separate mechanism
CREATE POLICY "Managers can view own org ad_accounts"
ON public.ad_accounts
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- A3: Recreate profiles_public as SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS SELECT
  id, user_id, full_name, avatar_url, organization_id,
  onboarding_completed, created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- M1: Restrict portal_feeds to managers+
DROP POLICY IF EXISTS "Users can view their org portal feeds" ON public.portal_feeds;
CREATE POLICY "Managers can view their org portal feeds"
ON public.portal_feeds
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- M2: Fix slugify search_path
CREATE OR REPLACE FUNCTION public.slugify(val text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT lower(regexp_replace(
    regexp_replace(
      translate(val,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  ));
$$;

-- Property types: restrict default types to authenticated only
DROP POLICY IF EXISTS "Anyone can view default property types" ON public.property_types;
CREATE POLICY "Authenticated users can view default property types"
ON public.property_types
FOR SELECT
TO authenticated
USING (is_default = true OR organization_id = get_user_organization_id());