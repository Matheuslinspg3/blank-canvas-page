CREATE OR REPLACE FUNCTION public.generate_contract_code(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now());
  v_count int;
  v_code text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text || v_year::text));
  
  SELECT count(*)
  INTO v_count
  FROM contracts
  WHERE organization_id = p_org_id
    AND created_at >= make_date(v_year, 1, 1)::timestamptz;
  
  v_code := 'CONT-' || v_year::text || '-' || lpad((v_count + 1)::text, 4, '0');
  
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_contract_code(uuid) TO authenticated;