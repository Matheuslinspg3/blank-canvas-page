-- =====================================================================
-- Fase 1 — Controle de Revisão de Imóveis
-- =====================================================================

-- 1. Coluna last_reviewed_at
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz NULL;

ALTER TABLE public.properties
  ALTER COLUMN last_reviewed_at SET DEFAULT now();

-- 2. Trigger comercial em properties (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.tg_properties_auto_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass para jobs técnicos
  IF current_setting('app.skip_review_touch', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Se a própria atualização já mexe em last_reviewed_at (ex.: RPC mark_property_reviewed
  -- ou trigger de property_images), não interferir.
  IF NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at THEN
    RETURN NEW;
  END IF;

  IF (NEW.title IS DISTINCT FROM OLD.title)
     OR (NEW.description IS DISTINCT FROM OLD.description)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.transaction_type IS DISTINCT FROM OLD.transaction_type)
     OR (NEW.property_type_id IS DISTINCT FROM OLD.property_type_id)
     OR (NEW.sale_price IS DISTINCT FROM OLD.sale_price)
     OR (NEW.sale_price_financed IS DISTINCT FROM OLD.sale_price_financed)
     OR (NEW.rent_price IS DISTINCT FROM OLD.rent_price)
     OR (NEW.condominium_fee IS DISTINCT FROM OLD.condominium_fee)
     OR (NEW.iptu IS DISTINCT FROM OLD.iptu)
     OR (NEW.bedrooms IS DISTINCT FROM OLD.bedrooms)
     OR (NEW.bathrooms IS DISTINCT FROM OLD.bathrooms)
     OR (NEW.suites IS DISTINCT FROM OLD.suites)
     OR (NEW.parking_spots IS DISTINCT FROM OLD.parking_spots)
     OR (NEW.area_total IS DISTINCT FROM OLD.area_total)
     OR (NEW.area_useful IS DISTINCT FROM OLD.area_useful)
     OR (NEW.area_built IS DISTINCT FROM OLD.area_built)
     OR (NEW.address_street IS DISTINCT FROM OLD.address_street)
     OR (NEW.address_number IS DISTINCT FROM OLD.address_number)
     OR (NEW.address_complement IS DISTINCT FROM OLD.address_complement)
     OR (NEW.address_neighborhood IS DISTINCT FROM OLD.address_neighborhood)
     OR (NEW.address_city IS DISTINCT FROM OLD.address_city)
     OR (NEW.address_state IS DISTINCT FROM OLD.address_state)
     OR (NEW.address_zipcode IS DISTINCT FROM OLD.address_zipcode)
     OR (NEW.latitude IS DISTINCT FROM OLD.latitude)
     OR (NEW.longitude IS DISTINCT FROM OLD.longitude)
     OR (NEW.amenities IS DISTINCT FROM OLD.amenities)
     OR (NEW.property_condition IS DISTINCT FROM OLD.property_condition)
     OR (NEW.launch_stage IS DISTINCT FROM OLD.launch_stage)
     OR (NEW.development_name IS DISTINCT FROM OLD.development_name)
     OR (NEW.beach_distance_meters IS DISTINCT FROM OLD.beach_distance_meters)
     OR (NEW.featured IS DISTINCT FROM OLD.featured)
  THEN
    NEW.last_reviewed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_auto_review ON public.properties;
CREATE TRIGGER trg_properties_auto_review
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_properties_auto_review();

-- 3. Trigger em property_images (AFTER INSERT/UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.tg_property_images_auto_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_should_touch boolean := false;
BEGIN
  IF current_setting('app.skip_review_touch', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    v_property_id := NEW.property_id;
    v_should_touch := true;
  ELSIF (TG_OP = 'DELETE') THEN
    v_property_id := OLD.property_id;
    v_should_touch := true;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_property_id := NEW.property_id;
    IF (NEW.is_cover IS DISTINCT FROM OLD.is_cover)
       OR (NEW.display_order IS DISTINCT FROM OLD.display_order) THEN
      v_should_touch := true;
    END IF;
  END IF;

  IF v_should_touch AND v_property_id IS NOT NULL THEN
    UPDATE public.properties
       SET last_reviewed_at = now()
     WHERE id = v_property_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_property_images_auto_review ON public.property_images;
CREATE TRIGGER trg_property_images_auto_review
  AFTER INSERT OR UPDATE OR DELETE ON public.property_images
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_property_images_auto_review();

-- 4. RPC mark_property_reviewed
CREATE OR REPLACE FUNCTION public.mark_property_reviewed(p_property_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user_org uuid;
  v_now timestamptz;
BEGIN
  v_user_org := public.get_user_organization_id();
  IF v_user_org IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.properties
   WHERE id = p_property_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_org <> v_user_org THEN
    RAISE EXCEPTION 'Forbidden: cross-tenant access';
  END IF;

  UPDATE public.properties
     SET last_reviewed_at = now()
   WHERE id = p_property_id
   RETURNING last_reviewed_at INTO v_now;

  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_property_reviewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_property_reviewed(uuid) TO authenticated;

-- 5. Recriar search_properties_advanced com p_owner_id e last_reviewed_at
DROP FUNCTION IF EXISTS public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[]
);
DROP FUNCTION IF EXISTS public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text
);

CREATE OR REPLACE FUNCTION public.search_properties_advanced(
  p_organization_id uuid,
  p_search_text text DEFAULT NULL,
  p_property_code text DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_property_type_id uuid DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_min_area numeric DEFAULT NULL,
  p_limit integer DEFAULT 2000,
  p_offset integer DEFAULT 0,
  p_min_suites integer DEFAULT NULL,
  p_min_parking integer DEFAULT NULL,
  p_max_area numeric DEFAULT NULL,
  p_min_condominium numeric DEFAULT NULL,
  p_max_condominium numeric DEFAULT NULL,
  p_amenities text[] DEFAULT NULL,
  p_property_condition text DEFAULT NULL,
  p_max_beach_distance integer DEFAULT NULL,
  p_launch_stage text DEFAULT NULL,
  p_neighborhoods text[] DEFAULT NULL,
  p_cities text[] DEFAULT NULL,
  p_sort_by text DEFAULT 'recent',
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  property_code text,
  title text,
  description text,
  address_city text,
  address_neighborhood text,
  address_state text,
  sale_price numeric,
  rent_price numeric,
  bedrooms integer,
  bathrooms integer,
  parking_spots integer,
  area_total numeric,
  area_built numeric,
  status text,
  transaction_type text,
  property_type_id uuid,
  cover_image_url text,
  beach_distance_meters integer,
  created_at timestamptz,
  updated_at timestamptz,
  last_reviewed_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT p.*
    FROM properties p
    WHERE p.organization_id = p_organization_id
      AND (p_search_text IS NULL
        OR p.title ILIKE '%' || p_search_text || '%'
        OR p.address_street ILIKE '%' || p_search_text || '%'
        OR p.address_city ILIKE '%' || p_search_text || '%'
        OR p.address_neighborhood ILIKE '%' || p_search_text || '%'
        OR p.property_code ILIKE '%' || p_search_text || '%'
        OR p.description ILIKE '%' || p_search_text || '%')
      AND (p_property_code IS NULL OR p.property_code ILIKE p_property_code || '%')
      AND (p_transaction_type IS NULL OR p_transaction_type = 'all'
        OR p.transaction_type::text = p_transaction_type
        OR (p_transaction_type IN ('venda', 'aluguel') AND p.transaction_type = 'ambos'))
      AND (p_status IS NULL OR p_status = 'all' OR p.status::text = p_status)
      AND (p_property_type_id IS NULL OR p.property_type_id = p_property_type_id)
      AND (p_min_price IS NULL OR COALESCE(p.sale_price, 0) >= p_min_price OR COALESCE(p.rent_price, 0) >= p_min_price)
      AND (p_max_price IS NULL OR (p.sale_price IS NOT NULL AND p.sale_price <= p_max_price) OR (p.rent_price IS NOT NULL AND p.rent_price <= p_max_price))
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
      AND (
        (p_neighborhoods IS NOT NULL AND array_length(p_neighborhoods, 1) > 0 AND p.address_neighborhood = ANY(p_neighborhoods))
        OR (p_neighborhood IS NOT NULL AND p.address_neighborhood ILIKE '%' || p_neighborhood || '%')
        OR (p_neighborhoods IS NULL AND p_neighborhood IS NULL)
      )
      AND (
        (p_cities IS NOT NULL AND array_length(p_cities, 1) > 0 AND p.address_city = ANY(p_cities))
        OR (p_city IS NOT NULL AND p.address_city ILIKE '%' || p_city || '%')
        OR (p_cities IS NULL AND p_city IS NULL)
      )
      AND (p_min_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) >= p_min_area)
      AND (p_min_suites IS NULL OR COALESCE(p.suites, 0) >= p_min_suites)
      AND (p_min_parking IS NULL OR COALESCE(p.parking_spots, 0) >= p_min_parking)
      AND (p_max_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) <= p_max_area)
      AND (p_min_condominium IS NULL OR COALESCE(p.condominium_fee, 0) >= p_min_condominium)
      AND (p_max_condominium IS NULL OR COALESCE(p.condominium_fee, 0) <= p_max_condominium)
      AND (p_amenities IS NULL OR p.amenities @> p_amenities)
      AND (p_property_condition IS NULL OR p.property_condition::text = p_property_condition)
      AND (p_max_beach_distance IS NULL OR (p.beach_distance_meters IS NOT NULL AND p.beach_distance_meters <= p_max_beach_distance))
      AND (p_launch_stage IS NULL OR p.launch_stage::text = p_launch_stage)
      AND (
        p_owner_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.property_owners po
           WHERE po.property_id = p.id
             AND po.owner_id = p_owner_id
             AND po.organization_id = p_organization_id
        )
      )
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.property_code::text,
    f.title::text,
    f.description::text,
    f.address_city::text,
    f.address_neighborhood::text,
    f.address_state::text,
    f.sale_price,
    f.rent_price,
    f.bedrooms,
    f.bathrooms,
    f.parking_spots,
    f.area_total,
    f.area_built,
    f.status::text,
    f.transaction_type::text,
    f.property_type_id,
    COALESCE(f.cover_image_url, (SELECT pi.url FROM property_images pi WHERE pi.property_id = f.id AND pi.is_cover = true LIMIT 1)) as cover_image_url,
    f.beach_distance_meters,
    f.created_at,
    f.updated_at,
    f.last_reviewed_at,
    c.cnt AS total_count
  FROM filtered f, counted c
  ORDER BY
    CASE WHEN p_sort_by = 'oldest' THEN f.created_at END ASC,
    CASE WHEN p_sort_by = 'price_asc' THEN f.sale_price END ASC,
    CASE WHEN p_sort_by = 'price_desc' THEN f.sale_price END DESC,
    CASE WHEN p_sort_by = 'beach_asc' THEN f.beach_distance_meters END ASC,
    CASE WHEN p_sort_by = 'beach_desc' THEN f.beach_distance_meters END DESC,
    CASE WHEN p_sort_by = 'recent' OR p_sort_by IS NULL THEN f.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
$function$;