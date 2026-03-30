
DROP VIEW IF EXISTS public.marketplace_properties_public;
DROP FUNCTION IF EXISTS public.get_marketplace_properties_public();

CREATE OR REPLACE FUNCTION public.get_marketplace_properties_public()
 RETURNS TABLE(id uuid, title text, description text, property_type_id uuid, transaction_type text, sale_price numeric, rent_price numeric, sale_price_financed bigint, payment_options text[], address_street text, address_number text, address_complement text, address_neighborhood text, address_city text, address_state text, address_zipcode text, bedrooms integer, suites integer, bathrooms integer, parking_spots integer, area_total numeric, area_built numeric, amenities text[], images text[], status text, is_featured boolean, external_code text, organization_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
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
    mp.organization_id, mp.created_at, mp.updated_at
  FROM public.marketplace_properties mp
  WHERE mp.status = 'disponivel'::property_status;
END;
$function$;

CREATE VIEW public.marketplace_properties_public AS
SELECT * FROM public.get_marketplace_properties_public();

GRANT SELECT ON public.marketplace_properties_public TO anon;
GRANT SELECT ON public.marketplace_properties_public TO authenticated;
