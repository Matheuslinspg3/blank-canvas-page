DROP FUNCTION IF EXISTS public.get_landing_contact(uuid, text);

CREATE OR REPLACE FUNCTION public.get_landing_contact(
  p_property_id uuid,
  p_broker_token text DEFAULT NULL
)
RETURNS TABLE (
  broker_name text,
  broker_phone text,
  broker_avatar text,
  broker_email text,
  org_name text,
  org_logo text,
  org_phone text,
  attribution_source text,
  org_whatsapp text,
  org_contact_phone text,
  org_contact_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_broker_id uuid;
  v_source text := 'org_fallback';
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.properties
  WHERE id = p_property_id;

  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.marketplace_properties
    WHERE id = p_property_id OR property_id = p_property_id
    LIMIT 1;
  END IF;

  IF p_broker_token IS NOT NULL THEN
    SELECT sl.broker_id INTO v_broker_id
    FROM public.property_share_links sl
    WHERE sl.broker_token = p_broker_token
      AND sl.active = true
      AND sl.property_id = p_property_id
    LIMIT 1;
    IF v_broker_id IS NOT NULL THEN v_source := 'shared_link'; END IF;
  END IF;

  IF v_broker_id IS NULL THEN
    SELECT captador_id INTO v_broker_id FROM public.properties WHERE id = p_property_id;
    IF v_broker_id IS NOT NULL THEN v_source := 'captador'; END IF;
  END IF;

  IF v_broker_id IS NULL THEN
    SELECT created_by INTO v_broker_id FROM public.properties WHERE id = p_property_id;
    IF v_broker_id IS NOT NULL THEN v_source := 'created_by'; END IF;
  END IF;

  IF v_broker_id IS NULL AND v_org_id IS NOT NULL THEN
    SELECT pr.user_id INTO v_broker_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.user_id
    WHERE pr.organization_id = v_org_id
      AND pr.phone IS NOT NULL AND length(trim(pr.phone)) > 0
      AND ur.role IN ('admin','sub_admin','owner')
    LIMIT 1;
    IF v_broker_id IS NOT NULL THEN v_source := 'org_admin'; END IF;
  END IF;

  RETURN QUERY
  SELECT
    pr.full_name::text,
    pr.phone::text,
    pr.avatar_url::text,
    pr.email::text,
    o.name::text,
    o.logo_url::text,
    o.phone::text,
    v_source,
    ws.whatsapp_number::text,
    ws.contact_phone::text,
    ws.contact_email::text
  FROM public.organizations o
  LEFT JOIN public.profiles pr ON pr.user_id = v_broker_id
  LEFT JOIN public.website_settings ws ON ws.organization_id = o.id
  WHERE o.id = v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_contact(uuid, text) TO anon, authenticated;