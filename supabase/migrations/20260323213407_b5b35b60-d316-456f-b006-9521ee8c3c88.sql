
-- RPC to check duplicates (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_signup_duplicates(
  p_email text,
  p_phone text,
  p_document text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  clean_phone text;
  clean_doc text;
BEGIN
  -- Check email in auth.users
  IF p_email IS NOT NULL AND p_email <> '' THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
      result := result || '{"email": "Este email já está cadastrado"}'::jsonb;
    END IF;
  END IF;

  -- Check phone in profiles (formatted)
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE phone = p_phone) THEN
      result := result || '{"phone": "Este telefone já está cadastrado"}'::jsonb;
    END IF;
  END IF;

  -- Check document in organizations (digits only)
  clean_doc := regexp_replace(COALESCE(p_document, ''), '\D', '', 'g');
  IF clean_doc <> '' THEN
    IF EXISTS (SELECT 1 FROM organizations WHERE document = clean_doc) THEN
      result := result || '{"document": "Este CPF/CNPJ já está cadastrado"}'::jsonb;
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- Grant access to anon so unauthenticated users can check before signup
GRANT EXECUTE ON FUNCTION public.check_signup_duplicates TO anon;
GRANT EXECUTE ON FUNCTION public.check_signup_duplicates TO authenticated;
