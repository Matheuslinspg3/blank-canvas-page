
-- 1. Add materialized cover_image_url column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Backfill from property_images
UPDATE properties p
SET cover_image_url = sub.url
FROM (
  SELECT DISTINCT ON (property_id) property_id, url
  FROM property_images
  WHERE is_cover = true
  ORDER BY property_id, display_order ASC
) sub
WHERE p.id = sub.property_id;

-- 3. Index for cover image lookup
CREATE INDEX IF NOT EXISTS idx_property_images_cover 
ON property_images (property_id) WHERE is_cover = true;

-- 4. Trigger to keep cover_image_url in sync
CREATE OR REPLACE FUNCTION public.sync_cover_image_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  v_property_id uuid;
  v_url text;
BEGIN
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  
  SELECT pi.url INTO v_url 
  FROM property_images pi 
  WHERE pi.property_id = v_property_id AND pi.is_cover = true 
  ORDER BY pi.display_order ASC
  LIMIT 1;
  
  UPDATE properties SET cover_image_url = v_url WHERE id = v_property_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cover_image ON property_images;
CREATE TRIGGER trg_sync_cover_image
AFTER INSERT OR UPDATE OR DELETE ON property_images
FOR EACH ROW EXECUTE FUNCTION public.sync_cover_image_url();

-- 5. Replace search_properties_advanced with sort support + materialized cover_image_url
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
  p_sort_by text DEFAULT 'recent'
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
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.property_code, p.title, p.description,
    p.address_city, p.address_neighborhood, p.address_state,
    p.sale_price, p.rent_price, p.bedrooms, p.bathrooms, p.parking_spots,
    p.area_total, p.area_built, p.status::text, p.transaction_type::text, p.property_type_id,
    p.cover_image_url,
    p.beach_distance_meters,
    p.created_at, p.updated_at,
    COUNT(*) OVER() AS total_count
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
  ORDER BY
    CASE WHEN p_sort_by = 'oldest' THEN EXTRACT(EPOCH FROM p.created_at) END ASC,
    CASE WHEN p_sort_by = 'price_asc' THEN COALESCE(p.sale_price, p.rent_price, 0) END ASC,
    CASE WHEN p_sort_by = 'price_desc' THEN COALESCE(p.sale_price, p.rent_price, 0) END DESC,
    CASE WHEN p_sort_by = 'beach_asc' THEN COALESCE(p.beach_distance_meters, 999999) END ASC,
    CASE WHEN p_sort_by = 'beach_desc' THEN COALESCE(p.beach_distance_meters, -1) END DESC,
    CASE WHEN p_sort_by = 'recent' OR p_sort_by IS NULL THEN EXTRACT(EPOCH FROM p.created_at) END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
