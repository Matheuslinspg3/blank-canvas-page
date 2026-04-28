CREATE OR REPLACE FUNCTION public.search_properties_advanced(
  p_organization_id uuid,
  p_search_text text DEFAULT NULL::text,
  p_property_code text DEFAULT NULL::text,
  p_transaction_type text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_property_type_id uuid DEFAULT NULL::uuid,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_bedrooms integer DEFAULT NULL::integer,
  p_neighborhood text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_min_area numeric DEFAULT NULL::numeric,
  p_limit integer DEFAULT 2000,
  p_offset integer DEFAULT 0,
  p_min_suites integer DEFAULT NULL::integer,
  p_min_parking integer DEFAULT NULL::integer,
  p_max_area numeric DEFAULT NULL::numeric,
  p_min_condominium numeric DEFAULT NULL::numeric,
  p_max_condominium numeric DEFAULT NULL::numeric,
  p_amenities text[] DEFAULT NULL::text[],
  p_property_condition text DEFAULT NULL::text,
  p_max_beach_distance integer DEFAULT NULL::integer,
  p_launch_stage text DEFAULT NULL::text,
  p_neighborhoods text[] DEFAULT NULL::text[],
  p_cities text[] DEFAULT NULL::text[],
  p_sort_by text DEFAULT 'recent'::text,
  p_owner_id uuid DEFAULT NULL::uuid,
  p_review_status text DEFAULT NULL::text,
  p_property_type_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  id uuid, property_code text, title text, description text,
  address_city text, address_neighborhood text, address_state text,
  sale_price numeric, rent_price numeric,
  bedrooms integer, bathrooms integer, parking_spots integer,
  area_total numeric, area_built numeric,
  status text, transaction_type text, property_type_id uuid,
  cover_image_url text, beach_distance_meters integer,
  created_at timestamptz, updated_at timestamptz, last_reviewed_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_org uuid := public.get_user_organization_id();
  v_overdue int; v_warning int; v_safe int;
BEGIN
  IF v_user_org IS NULL OR p_organization_id IS NULL OR p_organization_id <> v_user_org THEN
    RETURN;
  END IF;
  SELECT COALESCE(s.overdue_after_days, 60), COALESCE(s.warning_before_days, 15)
    INTO v_overdue, v_warning
  FROM (SELECT v_user_org AS oid) x
  LEFT JOIN public.property_review_settings s ON s.organization_id = x.oid;
  v_safe := v_overdue - v_warning;

  RETURN QUERY
  WITH filtered AS (
    SELECT p.* FROM public.properties p
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
      AND (
        (p_property_type_ids IS NOT NULL AND array_length(p_property_type_ids, 1) > 0
          AND p.property_type_id = ANY(p_property_type_ids))
        OR (p_property_type_ids IS NULL AND (p_property_type_id IS NULL OR p.property_type_id = p_property_type_id))
      )
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
        OR EXISTS (SELECT 1 FROM public.property_owners po
           WHERE po.property_id = p.id AND po.owner_id = p_owner_id AND po.organization_id = p_organization_id)
      )
      AND (
        p_review_status IS NULL OR p_review_status = 'all'
        OR (p_review_status = 'reviewed_30' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '30 days')
        OR (p_review_status = 'reviewed_60' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '60 days')
        OR (p_review_status = 'reviewed_90' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '90 days')
        OR (p_review_status = 'overdue_30' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '30 days'))
        OR (p_review_status = 'overdue_60' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '60 days'))
        OR (p_review_status = 'overdue_90' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '90 days'))
        OR (p_review_status = 'never' AND p.last_reviewed_at IS NULL)
        OR (p_review_status = 'overdue_configured'
            AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - (v_overdue * interval '1 day')))
        OR (p_review_status = 'near_due'
            AND p.last_reviewed_at IS NOT NULL
            AND p.last_reviewed_at < now() - (v_safe * interval '1 day')
            AND p.last_reviewed_at >= now() - (v_overdue * interval '1 day'))
        OR (p_review_status = 'within_due'
            AND p.last_reviewed_at IS NOT NULL
            AND p.last_reviewed_at >= now() - (v_safe * interval '1 day'))
      )
  ),
  counted AS (SELECT count(*) AS cnt FROM filtered)
  SELECT
    f.id, f.property_code::text, f.title::text, f.description::text,
    f.address_city::text, f.address_neighborhood::text, f.address_state::text,
    f.sale_price, f.rent_price, f.bedrooms, f.bathrooms, f.parking_spots,
    f.area_total, f.area_built, f.status::text, f.transaction_type::text, f.property_type_id,
    COALESCE(f.cover_image_url, (SELECT pi.url FROM public.property_images pi
        WHERE pi.property_id = f.id AND pi.is_cover = true LIMIT 1)) AS cover_image_url,
    f.beach_distance_meters, f.created_at, f.updated_at, f.last_reviewed_at,
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
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text, uuid, text, uuid[]
) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text, uuid, text, uuid[]
) TO authenticated;