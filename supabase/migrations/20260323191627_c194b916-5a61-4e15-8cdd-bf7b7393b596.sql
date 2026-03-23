-- Add document (CPF/CNPJ) column to organizations with unique constraint
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS document text;

-- Create unique index on document (only non-null, non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_document_unique 
  ON public.organizations (document) 
  WHERE document IS NOT NULL AND document <> '';

-- Create unique index on phone in profiles (only non-null, non-empty)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
  ON public.profiles (phone) 
  WHERE phone IS NOT NULL AND phone <> '';

-- Update handle_new_user to store document
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_account_type text;
  v_company_name text;
  v_full_name text;
  v_phone text;
  v_document text;
  v_selected_plan text;
  v_plan record;
  v_trial_end timestamptz;
  v_sub_status text;
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_full_name    := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone        := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document     := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'gratuito');

  -- Create organization
  INSERT INTO public.organizations (name, type, created_by, is_active, document)
  VALUES (v_company_name, v_account_type, NEW.id, true, NULLIF(v_document, ''))
  RETURNING id INTO v_org_id;

  -- Create profile
  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified)
  VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true);

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- Handle subscription based on selected plan
  SELECT id, slug, trial_days INTO v_plan
  FROM public.subscription_plans
  WHERE slug = v_selected_plan AND is_active = true
  LIMIT 1;

  IF v_plan.id IS NOT NULL THEN
    IF v_plan.slug = 'gratuito' THEN
      v_sub_status := 'active';
      v_trial_end := now() + interval '15 days';
    ELSIF v_plan.trial_days IS NOT NULL AND v_plan.trial_days > 0 THEN
      v_sub_status := 'trial';
      v_trial_end := now() + (v_plan.trial_days || ' days')::interval;
    ELSE
      v_sub_status := 'pending';
      v_trial_end := NULL;
    END IF;

    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'));
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Telefone ou documento já cadastrado em outra conta';
END;
$$;