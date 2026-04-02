-- 1. Normalization function
CREATE OR REPLACE FUNCTION normalize_location_text(val text)
RETURNS text AS $$
  SELECT INITCAP(TRIM(REGEXP_REPLACE(val, '\s+', ' ', 'g')))
$$ LANGUAGE sql IMMUTABLE;

-- 2. Trigger function for properties
CREATE OR REPLACE FUNCTION normalize_property_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.address_neighborhood IS NOT NULL THEN
    NEW.address_neighborhood := normalize_location_text(NEW.address_neighborhood);
  END IF;
  IF NEW.address_city IS NOT NULL THEN
    NEW.address_city := normalize_location_text(NEW.address_city);
  END IF;
  IF NEW.address_state IS NOT NULL THEN
    NEW.address_state := UPPER(TRIM(NEW.address_state));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
DROP TRIGGER IF EXISTS trg_normalize_property_location ON properties;
CREATE TRIGGER trg_normalize_property_location
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION normalize_property_location();

-- 4. Normalize existing data
UPDATE properties
SET
  address_neighborhood = normalize_location_text(address_neighborhood)
WHERE address_neighborhood IS NOT NULL
  AND address_neighborhood IS DISTINCT FROM normalize_location_text(address_neighborhood);

UPDATE properties
SET
  address_city = normalize_location_text(address_city)
WHERE address_city IS NOT NULL
  AND address_city IS DISTINCT FROM normalize_location_text(address_city);

UPDATE properties
SET
  address_state = UPPER(TRIM(address_state))
WHERE address_state IS NOT NULL
  AND address_state IS DISTINCT FROM UPPER(TRIM(address_state));