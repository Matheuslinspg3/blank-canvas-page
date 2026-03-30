
-- 1. Create trigger function to auto-sync marketplace when property is updated
CREATE OR REPLACE FUNCTION public.sync_marketplace_on_property_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_image_urls text[];
  v_owner record;
BEGIN
  -- Only sync if this property exists in marketplace_properties
  IF NOT EXISTS (SELECT 1 FROM marketplace_properties WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Get image URLs
  SELECT array_agg(url ORDER BY display_order ASC NULLS LAST)
  INTO v_image_urls
  FROM property_images
  WHERE property_id = NEW.id;

  -- Get primary owner
  SELECT name, phone, email INTO v_owner
  FROM property_owners
  WHERE property_id = NEW.id AND is_primary = true
  LIMIT 1;

  -- Update marketplace_properties
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
    sale_price_financed = NEW.sale_price_financed,
    payment_options = NEW.payment_options,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_sync_marketplace_on_property_update ON properties;
CREATE TRIGGER trg_sync_marketplace_on_property_update
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION sync_marketplace_on_property_update();

-- 3. Re-sync ALL existing marketplace properties with current data from properties
UPDATE marketplace_properties mp SET
  title = p.title,
  description = p.description,
  property_type_id = p.property_type_id,
  transaction_type = p.transaction_type,
  sale_price = p.sale_price,
  rent_price = p.rent_price,
  address_street = p.address_street,
  address_number = p.address_number,
  address_complement = p.address_complement,
  address_neighborhood = p.address_neighborhood,
  address_city = p.address_city,
  address_state = p.address_state,
  address_zipcode = p.address_zipcode,
  bedrooms = COALESCE(p.bedrooms, 0),
  suites = COALESCE(p.suites, 0),
  bathrooms = COALESCE(p.bathrooms, 0),
  parking_spots = COALESCE(p.parking_spots, 0),
  area_total = p.area_total,
  area_built = p.area_built,
  amenities = p.amenities,
  images = COALESCE((SELECT array_agg(pi.url ORDER BY pi.display_order ASC NULLS LAST) FROM property_images pi WHERE pi.property_id = p.id), '{}'),
  owner_name = po.name,
  owner_phone = po.phone,
  owner_email = po.email,
  status = p.status,
  external_code = p.property_code,
  commission_percentage = p.commission_value,
  sale_price_financed = p.sale_price_financed,
  payment_options = p.payment_options,
  updated_at = now()
FROM properties p
LEFT JOIN LATERAL (
  SELECT name, phone, email FROM property_owners WHERE property_id = p.id AND is_primary = true LIMIT 1
) po ON true
WHERE mp.id = p.id;
