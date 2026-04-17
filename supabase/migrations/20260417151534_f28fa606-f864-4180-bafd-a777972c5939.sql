-- 1. Substituir política frouxa por políticas granulares
DROP POLICY IF EXISTS "Managers can manage amenities" ON public.property_amenities;
DROP POLICY IF EXISTS "Members can create amenities" ON public.property_amenities;
DROP POLICY IF EXISTS "Owner or admin can update amenities" ON public.property_amenities;
DROP POLICY IF EXISTS "Owner or admin can delete amenities" ON public.property_amenities;

CREATE POLICY "Members can create amenities"
ON public.property_amenities
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "Owner or admin can update amenities"
ON public.property_amenities
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sub_admin'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

CREATE POLICY "Owner or admin can delete amenities"
ON public.property_amenities
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND is_default = false
  AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sub_admin'::app_role)
  )
);

-- 2. Trigger guard: bloqueia mudança de organization_id e created_by
CREATE OR REPLACE FUNCTION public.guard_property_amenity_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  NEW.name := trim(NEW.name);
  NEW.category := trim(coalesce(NEW.category, 'Geral'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_property_amenity_immutable ON public.property_amenities;
CREATE TRIGGER trg_guard_property_amenity_immutable
BEFORE UPDATE ON public.property_amenities
FOR EACH ROW
EXECUTE FUNCTION public.guard_property_amenity_immutable_fields();

-- 3. Contar uso de uma comodidade na org do caller
CREATE OR REPLACE FUNCTION public.count_amenity_usage(p_name text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(count(*), 0)::int
  FROM public.properties
  WHERE organization_id = public.get_user_organization_id()
    AND p_name = ANY(amenities);
$$;

-- 4. Remover comodidade de todos os imóveis da org
CREATE OR REPLACE FUNCTION public.remove_amenity_from_properties(p_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_organization_id();
  v_count int;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization context';
  END IF;

  UPDATE public.properties
  SET amenities = array_remove(amenities, p_name)
  WHERE organization_id = v_org
    AND p_name = ANY(amenities);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;