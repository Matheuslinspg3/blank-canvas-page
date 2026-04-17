-- 1) Add marketplace_contact_phone to properties + marketplace_properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone text;

ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone text;

-- 2) Sanitization trigger: trim, validate format, empty -> NULL
CREATE OR REPLACE FUNCTION public.sanitize_marketplace_contact_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.marketplace_contact_phone IS NOT NULL THEN
    NEW.marketplace_contact_phone := btrim(NEW.marketplace_contact_phone);
    IF NEW.marketplace_contact_phone = '' THEN
      NEW.marketplace_contact_phone := NULL;
    ELSIF NEW.marketplace_contact_phone !~ '^[0-9+()\-\s]{8,20}$' THEN
      RAISE EXCEPTION 'Telefone do Marketplace inválido. Use apenas dígitos, +, (), - e espaços (8 a 20 caracteres).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_marketplace_contact_phone_props ON public.properties;
CREATE TRIGGER trg_sanitize_marketplace_contact_phone_props
BEFORE INSERT OR UPDATE OF marketplace_contact_phone ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sanitize_marketplace_contact_phone();

DROP TRIGGER IF EXISTS trg_sanitize_marketplace_contact_phone_mp ON public.marketplace_properties;
CREATE TRIGGER trg_sanitize_marketplace_contact_phone_mp
BEFORE INSERT OR UPDATE OF marketplace_contact_phone ON public.marketplace_properties
FOR EACH ROW EXECUTE FUNCTION public.sanitize_marketplace_contact_phone();

-- 3) Update sync trigger to mirror marketplace_contact_phone
CREATE OR REPLACE FUNCTION public.sync_marketplace_on_property_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketplace_properties WHERE id = NEW.id) THEN
    UPDATE public.marketplace_properties
    SET
      title = NEW.title,
      description = NEW.description,
      property_type_id = NEW.property_type_id,
      transaction_type = NEW.transaction_type,
      sale_price = NEW.sale_price,
      rent_price = NEW.rent_price,
      address_street = NEW.address_street,
      address_number = NEW.address_number,
      address_complement = NEW.address_complement,
      address_neighborhood = NEW.address_neighborhood,
      address_city = NEW.address_city,
      address_state = NEW.address_state,
      address_zipcode = NEW.address_zipcode,
      bedrooms = COALESCE(NEW.bedrooms, 0),
      suites = COALESCE(NEW.suites, 0),
      bathrooms = COALESCE(NEW.bathrooms, 0),
      parking_spots = COALESCE(NEW.parking_spots, 0),
      area_total = NEW.area_total,
      area_built = NEW.area_built,
      amenities = NEW.amenities,
      status = NEW.status,
      marketplace_contact_phone = NEW.marketplace_contact_phone,
      updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_marketplace_on_property_update ON public.properties;
CREATE TRIGGER trg_sync_marketplace_on_property_update
AFTER UPDATE ON public.properties
FOR EACH ROW
WHEN (
  OLD.title IS DISTINCT FROM NEW.title OR
  OLD.description IS DISTINCT FROM NEW.description OR
  OLD.status IS DISTINCT FROM NEW.status OR
  OLD.sale_price IS DISTINCT FROM NEW.sale_price OR
  OLD.rent_price IS DISTINCT FROM NEW.rent_price OR
  OLD.bedrooms IS DISTINCT FROM NEW.bedrooms OR
  OLD.bathrooms IS DISTINCT FROM NEW.bathrooms OR
  OLD.suites IS DISTINCT FROM NEW.suites OR
  OLD.parking_spots IS DISTINCT FROM NEW.parking_spots OR
  OLD.area_total IS DISTINCT FROM NEW.area_total OR
  OLD.area_built IS DISTINCT FROM NEW.area_built OR
  OLD.address_street IS DISTINCT FROM NEW.address_street OR
  OLD.address_number IS DISTINCT FROM NEW.address_number OR
  OLD.address_neighborhood IS DISTINCT FROM NEW.address_neighborhood OR
  OLD.address_city IS DISTINCT FROM NEW.address_city OR
  OLD.amenities IS DISTINCT FROM NEW.amenities OR
  OLD.transaction_type IS DISTINCT FROM NEW.transaction_type OR
  OLD.property_type_id IS DISTINCT FROM NEW.property_type_id OR
  OLD.marketplace_contact_phone IS DISTINCT FROM NEW.marketplace_contact_phone
)
EXECUTE FUNCTION public.sync_marketplace_on_property_update();

-- 4) Relax marketplace_require_contact: per-property phone bypasses org requirement
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
    (NEW.marketplace_contact_phone IS NOT NULL AND length(btrim(NEW.marketplace_contact_phone)) >= 8)
    OR EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id AND phone IS NOT NULL AND length(btrim(phone)) >= 10)
    OR EXISTS (SELECT 1 FROM profiles WHERE organization_id = NEW.organization_id AND phone IS NOT NULL AND length(btrim(phone)) >= 10)
    OR (NEW.owner_phone IS NOT NULL AND length(btrim(NEW.owner_phone)) >= 10)
  ) INTO v_has_contact;

  IF NOT v_has_contact THEN
    RAISE EXCEPTION 'Cadastre o telefone público da imobiliária (ou do imóvel) antes de publicar no Marketplace.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Recreate public marketplace function/view to expose marketplace_contact_phone
DROP VIEW IF EXISTS public.marketplace_properties_public;
DROP FUNCTION IF EXISTS public.get_marketplace_properties_public();

CREATE OR REPLACE FUNCTION public.get_marketplace_properties_public()
 RETURNS TABLE(id uuid, title text, description text, property_type_id uuid, transaction_type text, sale_price numeric, rent_price numeric, sale_price_financed bigint, payment_options text[], address_street text, address_number text, address_complement text, address_neighborhood text, address_city text, address_state text, address_zipcode text, bedrooms integer, suites integer, bathrooms integer, parking_spots integer, area_total numeric, area_built numeric, amenities text[], images text[], status text, is_featured boolean, external_code text, organization_id uuid, marketplace_contact_phone text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mp.id, mp.title, mp.description, mp.property_type_id,
    mp.transaction_type::text, mp.sale_price, mp.rent_price,
    mp.sale_price_financed, mp.payment_options,
    mp.address_street, mp.address_number, mp.address_complement,
    mp.address_neighborhood, mp.address_city, mp.address_state, mp.address_zipcode,
    mp.bedrooms, mp.suites, mp.bathrooms, mp.parking_spots,
    mp.area_total, mp.area_built, mp.amenities, mp.images,
    mp.status::text, mp.is_featured, mp.external_code,
    mp.organization_id, mp.marketplace_contact_phone, mp.created_at, mp.updated_at
  FROM public.marketplace_properties mp
  WHERE mp.status = 'disponivel'::property_status;
END;
$function$;

CREATE VIEW public.marketplace_properties_public AS
SELECT * FROM public.get_marketplace_properties_public();

GRANT SELECT ON public.marketplace_properties_public TO authenticated;

-- 6) Update get_marketplace_contact RPC to prefer marketplace_contact_phone for org
DROP FUNCTION IF EXISTS public.get_marketplace_contact(uuid);

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
  v_mp_phone text;
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
  SELECT mp.organization_id, o.name, o.phone, o.email, o.logo_url, mp.marketplace_contact_phone
    INTO v_org_id, v_org_name, v_org_phone, v_org_email, v_org_logo, v_mp_phone
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  WHERE mp.id = p_property_id;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT captador_id, created_by, owner_name, owner_phone
    INTO v_captador_id, v_created_by, v_owner_name, v_owner_phone
  FROM properties
  WHERE id = p_property_id;

  IF v_owner_name IS NULL AND v_owner_phone IS NULL THEN
    SELECT owner_name, owner_phone INTO v_owner_name, v_owner_phone
    FROM marketplace_properties WHERE id = p_property_id;
  END IF;

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
    -- Marketplace-specific phone wins for org channel; falls back to org.phone, then any profile
    'org_phone', COALESCE(v_mp_phone, v_org_phone, v_fallback_phone),
    'org_email', v_org_email,
    'org_logo', v_org_logo,
    'broker_name', COALESCE(v_broker_name, v_fallback_name),
    'broker_phone', COALESCE(v_broker_phone, v_fallback_phone),
    'broker_avatar', COALESCE(v_broker_avatar, v_fallback_avatar),
    'owner_name', v_owner_name,
    'owner_phone', v_owner_phone,
    'marketplace_contact_phone', v_mp_phone
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_contact(uuid) TO anon, authenticated;