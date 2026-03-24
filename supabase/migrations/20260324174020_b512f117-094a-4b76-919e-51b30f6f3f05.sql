-- Fix: each org already has its own default types, so the OR is_default clause
-- causes users to see defaults from ALL orgs → duplicates.
-- Simplify to only show types belonging to the user's org.

DROP POLICY IF EXISTS "Authenticated users can view default property types" ON public.property_types;
DROP POLICY IF EXISTS "Users can view property types" ON public.property_types;

CREATE POLICY "Users can view own org property types"
ON public.property_types
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id());