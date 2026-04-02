
-- Fix: marketplace_properties uses address_neighborhood/address_city, not neighborhood/city
CREATE OR REPLACE FUNCTION public.normalize_marketplace_location()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.address_neighborhood IS NOT NULL THEN
    NEW.address_neighborhood := INITCAP(TRIM(REGEXP_REPLACE(NEW.address_neighborhood, '\s+', ' ', 'g')));
    IF NEW.address_neighborhood = '' THEN NEW.address_neighborhood := NULL; END IF;
  END IF;
  IF NEW.address_city IS NOT NULL THEN
    NEW.address_city := INITCAP(TRIM(REGEXP_REPLACE(NEW.address_city, '\s+', ' ', 'g')));
    IF NEW.address_city = '' THEN NEW.address_city := NULL; END IF;
  END IF;
  IF NEW.address_state IS NOT NULL THEN
    NEW.address_state := UPPER(TRIM(NEW.address_state));
    IF NEW.address_state = '' THEN NEW.address_state := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;
