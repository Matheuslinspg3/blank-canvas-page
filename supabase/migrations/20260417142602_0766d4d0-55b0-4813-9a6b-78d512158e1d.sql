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
  SELECT mp.organization_id, o.name, o.phone, o.email, o.logo_url,
         mp.owner_name, mp.owner_phone
    INTO v_org_id, v_org_name, v_org_phone, v_org_email, v_org_logo,
         v_owner_name, v_owner_phone
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  WHERE mp.id = p_property_id;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT captador_id, created_by INTO v_captador_id, v_created_by
  FROM properties WHERE id = p_property_id;

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