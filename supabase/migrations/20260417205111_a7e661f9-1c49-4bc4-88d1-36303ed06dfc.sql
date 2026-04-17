CREATE OR REPLACE FUNCTION public.auto_generate_property_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
  v_attempts INT := 0;
BEGIN
  -- Se property_code já foi informado, mantém
  IF NEW.property_code IS NOT NULL AND NEW.property_code <> '' THEN
    RETURN NEW;
  END IF;

  -- Advisory lock transacional por organização: serializa apenas geração
  -- dentro da mesma org (libera no commit/rollback)
  PERFORM pg_advisory_xact_lock(
    hashtext('property_code_gen'),
    hashtext(NEW.organization_id::text)
  );

  -- Loop defensivo (até 5 tentativas) caso o lock por algum motivo não cubra
  LOOP
    SELECT COALESCE(MAX(property_code::int), 0) + 1
      INTO v_next
      FROM properties
     WHERE organization_id = NEW.organization_id
       AND property_code ~ '^\d+$';

    NEW.property_code := v_next::text;

    -- Defesa em profundidade: confirma que o code está livre
    IF NOT EXISTS (
      SELECT 1 FROM properties
       WHERE organization_id = NEW.organization_id
         AND property_code = NEW.property_code
    ) THEN
      RETURN NEW;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Não foi possível gerar property_code único após 5 tentativas para org %', NEW.organization_id;
    END IF;
  END LOOP;
END;
$$;