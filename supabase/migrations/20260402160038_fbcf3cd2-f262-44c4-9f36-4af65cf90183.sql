
-- 1) Normalize lead phone (strip non-digits) and name (trim) on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.normalize_lead_fields()
RETURNS trigger AS $$
BEGIN
  -- Normalize phone: strip all non-digit characters
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := REGEXP_REPLACE(TRIM(NEW.phone), '[^0-9+]', '', 'g');
    IF NEW.phone = '' THEN NEW.phone := NULL; END IF;
  END IF;
  
  -- Normalize email: lowercase + trim
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
    IF NEW.email = '' THEN NEW.email := NULL; END IF;
  END IF;
  
  -- Normalize name: trim extra spaces
  IF NEW.name IS NOT NULL THEN
    NEW.name := TRIM(REGEXP_REPLACE(NEW.name, '\s+', ' ', 'g'));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_lead_fields ON public.leads;
CREATE TRIGGER trg_normalize_lead_fields
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_fields();

-- 2) Prevent duplicate leads per organization by phone or email (only for new inserts)
CREATE OR REPLACE FUNCTION public.check_lead_duplicate_on_insert()
RETURNS trigger AS $$
DECLARE
  clean_phone TEXT;
  dup_id UUID;
BEGIN
  -- Only check active leads
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  
  clean_phone := REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  
  -- Check phone duplicate (min 8 digits)
  IF LENGTH(clean_phone) >= 8 THEN
    SELECT id INTO dup_id FROM public.leads
    WHERE organization_id = NEW.organization_id
      AND is_active = true
      AND REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = clean_phone
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    
    IF dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lead duplicado: já existe um lead ativo com este telefone nesta organização (id: %)', dup_id;
    END IF;
  END IF;
  
  -- Check email duplicate
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO dup_id FROM public.leads
    WHERE organization_id = NEW.organization_id
      AND is_active = true
      AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    
    IF dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lead duplicado: já existe um lead ativo com este e-mail nesta organização (id: %)', dup_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_lead_duplicate ON public.leads;
CREATE TRIGGER trg_check_lead_duplicate
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.check_lead_duplicate_on_insert();

-- 3) Extend location normalization to marketplace_properties
CREATE OR REPLACE FUNCTION public.normalize_marketplace_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.neighborhood IS NOT NULL THEN
    NEW.neighborhood := INITCAP(TRIM(REGEXP_REPLACE(NEW.neighborhood, '\s+', ' ', 'g')));
    IF NEW.neighborhood = '' THEN NEW.neighborhood := NULL; END IF;
  END IF;
  IF NEW.city IS NOT NULL THEN
    NEW.city := INITCAP(TRIM(REGEXP_REPLACE(NEW.city, '\s+', ' ', 'g')));
    IF NEW.city = '' THEN NEW.city := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_marketplace_location ON public.marketplace_properties;
CREATE TRIGGER trg_normalize_marketplace_location
  BEFORE INSERT OR UPDATE ON public.marketplace_properties
  FOR EACH ROW EXECUTE FUNCTION public.normalize_marketplace_location();
