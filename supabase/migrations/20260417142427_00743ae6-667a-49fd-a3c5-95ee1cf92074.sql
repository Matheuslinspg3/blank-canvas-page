-- 1) Drop existing function (return type changes)
DROP FUNCTION IF EXISTS public.get_marketplace_contact(uuid);

-- 2) Recreate with full contact resolution + cascading fallback
CREATE OR REPLACE FUNCTION public.get_marketplace_contact(p_property_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_org_phone text;
  v_org_email text;
  v_org_logo text;
  v_captador_id uuid;
  v_created_by uuid;
  v_broker_name text;
  v_broker_phone text;
  v_broker_avatar text;
  v_owner_name text;
  v_owner_phone text;
  v_fallback_name text;
  v_fallback_phone text;
  v_fallback_avatar text;
BEGIN
  -- Pull marketplace + org basics
  SELECT mp.organization_id, o.name, o.phone, o.email, o.logo_url
    INTO v_org_id, v_org_name, v_org_phone, v_org_email, v_org_logo
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  WHERE mp.id = p_property_id;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try to find captador / created_by from the matching property row
  SELECT captador_id, created_by, owner_name, owner_phone
    INTO v_captador_id, v_created_by, v_owner_name, v_owner_phone
  FROM properties
  WHERE id = p_property_id;

  -- If property row missing, fall back to marketplace_properties owner_* fields
  IF v_owner_name IS NULL AND v_owner_phone IS NULL THEN
    SELECT owner_name, owner_phone INTO v_owner_name, v_owner_phone
    FROM marketplace_properties WHERE id = p_property_id;
  END IF;

  -- Resolve broker from captador first, then created_by
  IF v_captador_id IS NOT NULL THEN
    SELECT full_name, phone, avatar_url
      INTO v_broker_name, v_broker_phone, v_broker_avatar
    FROM profiles
    WHERE user_id = v_captador_id AND organization_id = v_org_id
    LIMIT 1;
  END IF;

  IF (v_broker_name IS NULL OR v_broker_phone IS NULL) AND v_created_by IS NOT NULL THEN
    SELECT
      COALESCE(v_broker_name, full_name),
      COALESCE(v_broker_phone, phone),
      COALESCE(v_broker_avatar, avatar_url)
      INTO v_broker_name, v_broker_phone, v_broker_avatar
    FROM profiles
    WHERE user_id = v_created_by AND organization_id = v_org_id
    LIMIT 1;
  END IF;

  -- Cascading fallback: any admin/sub_admin profile in the org with a phone
  IF v_broker_phone IS NULL THEN
    SELECT pr.full_name, pr.phone, pr.avatar_url
      INTO v_fallback_name, v_fallback_phone, v_fallback_avatar
    FROM profiles pr
    JOIN user_roles ur ON ur.user_id = pr.user_id
    WHERE pr.organization_id = v_org_id
      AND pr.phone IS NOT NULL
      AND ur.role IN ('admin','sub_admin')
    ORDER BY CASE ur.role WHEN 'admin' THEN 0 ELSE 1 END
    LIMIT 1;

    -- If no admin with phone, try ANY profile in the org with phone
    IF v_fallback_phone IS NULL THEN
      SELECT full_name, phone, avatar_url
        INTO v_fallback_name, v_fallback_phone, v_fallback_avatar
      FROM profiles
      WHERE organization_id = v_org_id AND phone IS NOT NULL
      LIMIT 1;
    END IF;
  END IF;

  RETURN json_build_object(
    'org_name', v_org_name,
    'org_phone', COALESCE(v_org_phone, v_fallback_phone),
    'org_email', v_org_email,
    'org_logo', v_org_logo,
    'broker_name', COALESCE(v_broker_name, v_fallback_name),
    'broker_phone', COALESCE(v_broker_phone, v_fallback_phone),
    'broker_avatar', COALESCE(v_broker_avatar, v_fallback_avatar),
    'owner_name', v_owner_name,
    'owner_phone', v_owner_phone
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_contact(uuid) TO anon, authenticated;

-- 3) Guardrail trigger: block marketplace publication without resolvable contact
CREATE OR REPLACE FUNCTION public.trg_marketplace_require_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_contact boolean;
BEGIN
  SELECT (
    EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id AND phone IS NOT NULL AND length(btrim(phone)) >= 10)
    OR EXISTS (SELECT 1 FROM profiles WHERE organization_id = NEW.organization_id AND phone IS NOT NULL AND length(btrim(phone)) >= 10)
    OR (NEW.owner_phone IS NOT NULL AND length(btrim(NEW.owner_phone)) >= 10)
  ) INTO v_has_contact;

  IF NOT v_has_contact THEN
    RAISE EXCEPTION 'Cadastre o telefone público da imobiliária antes de publicar imóveis no Marketplace.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS marketplace_require_contact ON public.marketplace_properties;
CREATE TRIGGER marketplace_require_contact
BEFORE INSERT ON public.marketplace_properties
FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_require_contact();

-- 4) Health check view for admins
CREATE OR REPLACE VIEW public.vw_marketplace_orgs_missing_contact AS
SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.phone AS org_phone,
  COUNT(mp.id) AS marketplace_properties_count,
  EXISTS (SELECT 1 FROM profiles p WHERE p.organization_id = o.id AND p.phone IS NOT NULL) AS has_profile_with_phone
FROM organizations o
JOIN marketplace_properties mp ON mp.organization_id = o.id
WHERE (o.phone IS NULL OR length(btrim(o.phone)) < 10)
GROUP BY o.id, o.name, o.phone;

REVOKE ALL ON public.vw_marketplace_orgs_missing_contact FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vw_marketplace_orgs_missing_contact TO authenticated;