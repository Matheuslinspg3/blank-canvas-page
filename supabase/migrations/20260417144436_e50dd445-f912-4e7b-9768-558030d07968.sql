
-- Trigger to keep marketplace_properties in sync when properties is updated
CREATE OR REPLACE FUNCTION public.sync_marketplace_on_property_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if a marketplace row exists for this property
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
  OLD.property_type_id IS DISTINCT FROM NEW.property_type_id
)
EXECUTE FUNCTION public.sync_marketplace_on_property_update();

-- Health-check view: marketplace rows that drifted from properties
CREATE OR REPLACE VIEW public.vw_marketplace_status_drift AS
SELECT
  p.id AS property_id,
  p.organization_id,
  p.title,
  p.status AS property_status,
  mp.status AS marketplace_status,
  p.updated_at AS property_updated_at,
  mp.updated_at AS marketplace_updated_at
FROM public.properties p
JOIN public.marketplace_properties mp ON mp.id = p.id
WHERE p.updated_at > mp.updated_at
   OR p.status IS DISTINCT FROM mp.status
   OR p.title IS DISTINCT FROM mp.title;
