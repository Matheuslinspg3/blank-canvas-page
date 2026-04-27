-- =====================================================================
-- Marketplace Contact Phone Source
-- Aditiva, idempotente. Não remove a coluna marketplace_contact_phone.
-- =====================================================================

-- 1) Add source column to both tables
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone_source text NOT NULL DEFAULT 'organization';

ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone_source text NOT NULL DEFAULT 'organization';

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_marketplace_contact_phone_source_chk;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_marketplace_contact_phone_source_chk
  CHECK (marketplace_contact_phone_source IN ('organization','owner','custom'));

ALTER TABLE public.marketplace_properties
  DROP CONSTRAINT IF EXISTS mp_marketplace_contact_phone_source_chk;
ALTER TABLE public.marketplace_properties
  ADD CONSTRAINT mp_marketplace_contact_phone_source_chk
  CHECK (marketplace_contact_phone_source IN ('organization','owner','custom'));

-- 2) Backfill (one-shot, safe to re-run)
UPDATE public.properties
   SET marketplace_contact_phone_source = 'custom'
 WHERE marketplace_contact_phone IS NOT NULL
   AND length(btrim(marketplace_contact_phone)) > 0
   AND marketplace_contact_phone_source = 'organization';

UPDATE public.marketplace_properties
   SET marketplace_contact_phone_source = 'custom'
 WHERE marketplace_contact_phone IS NOT NULL
   AND length(btrim(marketplace_contact_phone)) > 0
   AND marketplace_contact_phone_source = 'organization';

-- 3) Sanitization + domain trigger (consolidated). Runs FIRST (trg_00_).
CREATE OR REPLACE FUNCTION public.sanitize_marketplace_contact_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Normaliza source
  IF NEW.marketplace_contact_phone_source IS NULL THEN
    NEW.marketplace_contact_phone_source := 'organization';
  ELSE
    NEW.marketplace_contact_phone_source := lower(btrim(NEW.marketplace_contact_phone_source));
    IF NEW.marketplace_contact_phone_source NOT IN ('organization','owner','custom') THEN
      RAISE EXCEPTION 'Origem do telefone do Marketplace inválida: %', NEW.marketplace_contact_phone_source
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Sanitiza telefone manual
  IF NEW.marketplace_contact_phone IS NOT NULL THEN
    NEW.marketplace_contact_phone := btrim(NEW.marketplace_contact_phone);
    IF NEW.marketplace_contact_phone = '' THEN
      NEW.marketplace_contact_phone := NULL;
    END IF;
  END IF;

  -- Domain rule: source != custom => sempre limpar telefone manual
  IF NEW.marketplace_contact_phone_source <> 'custom' THEN
    NEW.marketplace_contact_phone := NULL;
  ELSIF NEW.marketplace_contact_phone IS NOT NULL THEN
    -- Valida formato apenas quando source = custom e há telefone
    IF NEW.marketplace_contact_phone !~ '^[0-9+()\-\s]{8,20}$' THEN
      RAISE EXCEPTION 'Telefone do Marketplace inválido. Use apenas dígitos, +, (), - e espaços (8 a 20 caracteres).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_marketplace_contact_phone_props ON public.properties;
DROP TRIGGER IF EXISTS trg_sanitize_marketplace_contact_phone_mp ON public.marketplace_properties;
DROP TRIGGER IF EXISTS trg_00_sanitize_marketplace_contact_source_props ON public.properties;
DROP TRIGGER IF EXISTS trg_00_sanitize_marketplace_contact_source_mp ON public.marketplace_properties;

CREATE TRIGGER trg_00_sanitize_marketplace_contact_source_props
  BEFORE INSERT OR UPDATE OF marketplace_contact_phone, marketplace_contact_phone_source
  ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_marketplace_contact_source();

CREATE TRIGGER trg_00_sanitize_marketplace_contact_source_mp
  BEFORE INSERT OR UPDATE OF marketplace_contact_phone, marketplace_contact_phone_source
  ON public.marketplace_properties
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_marketplace_contact_source();

-- 4) Publication validation trigger. Runs SECOND (trg_10_) on INSERT only.
CREATE OR REPLACE FUNCTION public.trg_marketplace_require_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_phone text;
  v_org_phone   text;
BEGIN
  SELECT o.phone
    INTO v_owner_phone
  FROM public.property_owners po
  JOIN public.owners o ON o.id = po.owner_id
  WHERE po.property_id = NEW.id
  ORDER BY COALESCE(po.is_primary, false) DESC, po.created_at ASC
  LIMIT 1;

  IF v_owner_phone IS NULL OR length(btrim(v_owner_phone)) < 8 THEN
    v_owner_phone := NEW.owner_phone;
  END IF;

  SELECT phone INTO v_org_phone
  FROM public.organizations WHERE id = NEW.organization_id;

  IF NEW.marketplace_contact_phone_source = 'custom' THEN
    IF NEW.marketplace_contact_phone IS NULL OR length(btrim(NEW.marketplace_contact_phone)) < 8 THEN
      RAISE EXCEPTION 'Para publicar com Telefone Personalizado, informe um número válido (mínimo 8 dígitos).'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.marketplace_contact_phone_source = 'owner' THEN
    IF v_owner_phone IS NULL OR length(btrim(v_owner_phone)) < 8 THEN
      RAISE EXCEPTION 'Para publicar usando o telefone do proprietário, vincule um proprietário com telefone válido ao imóvel.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE -- 'organization'
    IF (v_org_phone IS NULL OR length(btrim(v_org_phone)) < 8)
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE organization_id = NEW.organization_id
           AND phone IS NOT NULL
           AND length(btrim(phone)) >= 10
       ) THEN
      RAISE EXCEPTION 'Cadastre o telefone público da imobiliária antes de publicar no Marketplace, ou escolha outra origem do telefone.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS marketplace_require_contact ON public.marketplace_properties;
DROP TRIGGER IF EXISTS trg_10_marketplace_require_contact ON public.marketplace_properties;

CREATE TRIGGER trg_10_marketplace_require_contact
  BEFORE INSERT ON public.marketplace_properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_require_contact();

-- 5) Sync trigger: copy source as well
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
      marketplace_contact_phone_source = NEW.marketplace_contact_phone_source,
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
  OLD.marketplace_contact_phone IS DISTINCT FROM NEW.marketplace_contact_phone OR
  OLD.marketplace_contact_phone_source IS DISTINCT FROM NEW.marketplace_contact_phone_source
)
EXECUTE FUNCTION public.sync_marketplace_on_property_update();

-- 6) Public listing: include SOURCE, never owner_phone
DROP VIEW IF EXISTS public.marketplace_properties_public;
DROP FUNCTION IF EXISTS public.get_marketplace_properties_public();

CREATE OR REPLACE FUNCTION public.get_marketplace_properties_public()
 RETURNS TABLE(
   id uuid, title text, description text, property_type_id uuid, transaction_type text,
   sale_price numeric, rent_price numeric, sale_price_financed bigint, payment_options text[],
   address_street text, address_number text, address_complement text,
   address_neighborhood text, address_city text, address_state text, address_zipcode text,
   bedrooms integer, suites integer, bathrooms integer, parking_spots integer,
   area_total numeric, area_built numeric, amenities text[], images text[], status text,
   is_featured boolean, external_code text, organization_id uuid,
   marketplace_contact_phone text,
   marketplace_contact_phone_source text,
   created_at timestamp with time zone, updated_at timestamp with time zone
 )
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
    mp.organization_id,
    mp.marketplace_contact_phone,
    COALESCE(mp.marketplace_contact_phone_source, 'organization') AS marketplace_contact_phone_source,
    mp.created_at, mp.updated_at
  FROM public.marketplace_properties mp
  WHERE mp.status = 'disponivel'::property_status;
END;
$function$;

CREATE VIEW public.marketplace_properties_public AS
SELECT * FROM public.get_marketplace_properties_public();

GRANT SELECT ON public.marketplace_properties_public TO authenticated;

-- 7) RPC get_marketplace_contact: resolves phone per source
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
  v_source text;
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
  v_resolved_phone  text;
  v_resolved_label  text;
  v_resolution_status text;
BEGIN
  SELECT mp.organization_id, o.name, o.phone, o.email, o.logo_url,
         mp.marketplace_contact_phone,
         COALESCE(mp.marketplace_contact_phone_source, 'organization')
    INTO v_org_id, v_org_name, v_org_phone, v_org_email, v_org_logo, v_mp_phone, v_source
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  WHERE mp.id = p_property_id;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT captador_id, created_by
    INTO v_captador_id, v_created_by
  FROM properties WHERE id = p_property_id;

  SELECT ow.primary_name, ow.phone
    INTO v_owner_name, v_owner_phone
  FROM property_owners po
  JOIN owners ow ON ow.id = po.owner_id
  WHERE po.property_id = p_property_id
  ORDER BY COALESCE(po.is_primary, false) DESC, po.created_at ASC
  LIMIT 1;

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

  -- Resolução do telefone final por source
  v_resolution_status := 'ok';

  IF v_source = 'custom' THEN
    IF v_mp_phone IS NOT NULL AND length(btrim(v_mp_phone)) >= 8 THEN
      v_resolved_phone := v_mp_phone;
      v_resolved_label := 'Contato direto do anúncio';
    ELSE
      v_resolved_phone := COALESCE(v_org_phone, v_fallback_phone);
      v_resolved_label := 'Telefone da imobiliária';
      v_resolution_status := CASE WHEN v_resolved_phone IS NULL THEN 'missing' ELSE 'fallback' END;
    END IF;

  ELSIF v_source = 'owner' THEN
    IF v_owner_phone IS NOT NULL AND length(btrim(v_owner_phone)) >= 8 THEN
      v_resolved_phone := v_owner_phone;
      v_resolved_label := 'Telefone do proprietário';
    ELSE
      v_resolved_phone := COALESCE(v_org_phone, v_fallback_phone);
      v_resolved_label := 'Telefone da imobiliária';
      v_resolution_status := CASE WHEN v_resolved_phone IS NULL THEN 'missing' ELSE 'fallback' END;
    END IF;

  ELSE -- 'organization'
    v_resolved_phone := COALESCE(v_org_phone, v_fallback_phone);
    v_resolved_label := 'Telefone da imobiliária';
    IF v_resolved_phone IS NULL THEN
      v_resolution_status := 'missing';
    END IF;
  END IF;

  RETURN json_build_object(
    'org_name', v_org_name,
    -- LEGADO/COMPAT: 'org_phone' agora aponta para o TELEFONE RESOLVIDO,
    -- não necessariamente o telefone real da imobiliária. Use
    -- 'resolved_marketplace_contact_phone' nos novos componentes.
    -- Se algum componente futuro precisar do telefone REAL da imobiliária,
    -- adicionar e usar um campo separado 'organization_phone'.
    'org_phone', v_resolved_phone,
    'org_email', v_org_email,
    'org_logo', v_org_logo,
    'broker_name', COALESCE(v_broker_name, v_fallback_name),
    'broker_phone', COALESCE(v_broker_phone, v_fallback_phone),
    'broker_avatar', COALESCE(v_broker_avatar, v_fallback_avatar),
    'owner_name', v_owner_name,
    -- owner_phone NÃO é exposto: mantido NULL para evitar vazamento
    'owner_phone', NULL,
    -- LEGADO/COMPAT: reflete o telefone resolvido final
    'marketplace_contact_phone', v_resolved_phone,
    -- NOVOS CAMPOS canônicos
    'marketplace_contact_source', v_source,
    'resolved_marketplace_contact_phone', v_resolved_phone,
    'resolved_marketplace_contact_label', v_resolved_label,
    'contact_resolution_status', v_resolution_status
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_contact(uuid) TO anon, authenticated;