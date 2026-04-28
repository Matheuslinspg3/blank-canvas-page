-- Garantir extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Recriar função utilitária (drop primeiro por causa do parâmetro)
DROP FUNCTION IF EXISTS public.normalize_location_text(text);
CREATE FUNCTION public.normalize_location_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT lower(btrim(extensions.unaccent(coalesce(input, ''))));
$$;

-- Correção dos dados (cidades)
UPDATE public.properties SET address_city = 'Mongaguá', updated_at = now() WHERE address_city = 'Mongagua';
UPDATE public.properties SET address_city = 'Itanhaém', updated_at = now() WHERE address_city = 'Itanhaem';

-- Correção dos dados (bairros)
UPDATE public.properties SET address_neighborhood = 'Vila Antártica', updated_at = now() WHERE address_neighborhood = 'Vila Antartica';
UPDATE public.properties SET address_neighborhood = 'Flórida', updated_at = now() WHERE address_neighborhood = 'Florida';

-- Trigger de prevenção
CREATE OR REPLACE FUNCTION public.normalize_property_location_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.address_city IS NOT NULL THEN
    NEW.address_city := NULLIF(btrim(regexp_replace(NEW.address_city, '\s+', ' ', 'g')), '');
  END IF;
  IF NEW.address_neighborhood IS NOT NULL THEN
    NEW.address_neighborhood := NULLIF(btrim(regexp_replace(NEW.address_neighborhood, '\s+', ' ', 'g')), '');
  END IF;
  IF NEW.address_state IS NOT NULL THEN
    NEW.address_state := NULLIF(btrim(NEW.address_state), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_property_location ON public.properties;
CREATE TRIGGER trg_normalize_property_location
BEFORE INSERT OR UPDATE OF address_city, address_neighborhood, address_state
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.normalize_property_location_fields();