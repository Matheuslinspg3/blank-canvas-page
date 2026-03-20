-- Step 1: Fix NULL confirmation_token/recovery_token causing "Database error querying schema"
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;

UPDATE auth.users 
SET email_change_token_new = '' 
WHERE email_change_token_new IS NULL;

UPDATE auth.users 
SET email_change_token_current = '' 
WHERE email_change_token_current IS NULL;

UPDATE auth.users 
SET reauthentication_token = '' 
WHERE reauthentication_token IS NULL;

-- Step 2: Reconnect the trigger handle_new_user to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Backfill organizations, profiles and user_roles for all existing users
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
  v_full_name TEXT;
  v_phone TEXT;
  v_account_type TEXT;
  v_company_name TEXT;
BEGIN
  FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users ORDER BY created_at
  LOOP
    -- Skip if profile already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = r.id) THEN
      CONTINUE;
    END IF;

    v_full_name := COALESCE(r.raw_user_meta_data->>'full_name', 'Usuario');
    v_phone := r.raw_user_meta_data->>'phone';
    v_account_type := COALESCE(r.raw_user_meta_data->>'account_type', 'corretor_individual');
    v_company_name := r.raw_user_meta_data->>'company_name';

    -- Create organization
    INSERT INTO public.organizations (name, type, email, created_by)
    VALUES (
      CASE 
        WHEN v_account_type = 'imobiliaria' AND v_company_name IS NOT NULL 
        THEN v_company_name 
        ELSE v_full_name 
      END,
      CASE 
        WHEN v_account_type = 'imobiliaria' THEN 'imobiliaria'::organization_type 
        ELSE 'corretor_individual'::organization_type 
      END,
      r.email,
      r.id
    )
    RETURNING id INTO v_org_id;

    -- Create profile
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (r.id, v_org_id, v_full_name, v_phone);

    -- Create user_role as admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Backfilled user % (%)', r.email, r.id;
  END LOOP;
END $$;