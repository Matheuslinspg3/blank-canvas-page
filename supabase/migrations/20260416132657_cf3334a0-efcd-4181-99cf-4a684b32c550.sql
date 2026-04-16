CREATE OR REPLACE FUNCTION public.sync_marketplace_on_property_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_image_urls text[];
  v_owner record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM marketplace_properties WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(url ORDER BY display_order ASC NULLS LAST)
  INTO v_image_urls
  FROM property_images
  WHERE property_id = NEW.id;

  SELECT name, phone, email INTO v_owner
  FROM property_owners
  WHERE property_id = NEW.id AND is_primary = true
  LIMIT 1;

  UPDATE marketplace_properties SET
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
    images = COALESCE(v_image_urls, '{}'),
    owner_name = v_owner.name,
    owner_phone = v_owner.phone,
    owner_email = v_owner.email,
    status = NEW.status,
    external_code = NEW.property_code,
    commission_percentage = NEW.commission_value,
    sale_price_financed = CASE
      WHEN NEW.sale_price_financed IS NULL THEN NULL
      ELSE ROUND(NEW.sale_price_financed)::bigint
    END,
    payment_options = NEW.payment_options,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;