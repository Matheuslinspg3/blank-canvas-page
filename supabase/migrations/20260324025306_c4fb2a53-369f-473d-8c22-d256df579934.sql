CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_slug text;
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_full_name    := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone        := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document     := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'gratuito');

  v_slug := lower(regexp_replace(
    regexp_replace(
      public.unaccent(v_company_name),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  ));
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.organizations (name, type, created_by, is_active, document, slug)
  VALUES (v_company_name, v_account_type::organization_type, NEW.id, true, NULLIF(v_document, ''), v_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified)
  VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

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