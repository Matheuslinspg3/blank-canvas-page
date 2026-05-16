-- Enforce the 15-day trial against the same public commercial plan catalog used by checkout.
-- This keeps signup/onboarding aligned with the public UI and avoids falling back to legacy plans.

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
  v_sub_status public.subscription_status;
  v_slug text;
  v_provider text;
  v_is_oauth boolean;
BEGIN
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_is_oauth := v_provider IS DISTINCT FROM 'email';

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );

  IF v_is_oauth THEN
    v_company_name := v_full_name;

    v_slug := lower(regexp_replace(
      regexp_replace(
        extensions.unaccent(v_company_name),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ));
    v_slug := NULLIF(v_slug, '') || '-' || substr(md5(random()::text), 1, 6);
    IF v_slug IS NULL OR v_slug = '' THEN
      v_slug := 'org-' || substr(md5(random()::text), 1, 8);
    END IF;

    INSERT INTO public.organizations (name, type, created_by, is_active, slug)
    VALUES (v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.profiles (user_id, organization_id, full_name, onboarding_completed, email_verified)
    VALUES (NEW.id, v_org_id, v_full_name, false, true);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');

    RETURN NEW;
  END IF;

  v_account_type  := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name  := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document      := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'essencial');

  IF v_selected_plan NOT IN ('essencial', 'profissional', 'business') THEN
    v_selected_plan := 'essencial';
  END IF;

  SELECT id, slug, trial_days INTO v_plan
  FROM public.subscription_plans
  WHERE slug = v_selected_plan
    AND is_active = true
    AND COALESCE(features->>'is_internal', 'false') <> 'true'
    AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true'
    AND COALESCE(features->>'is_purchasable', 'true') <> 'false'
  LIMIT 1;

  IF v_plan.id IS NOT NULL AND COALESCE(v_plan.trial_days, 0) > 0 THEN
    v_sub_status := 'trial'::public.subscription_status;
    v_trial_end  := now() + (v_plan.trial_days || ' days')::interval;
  ELSE
    v_sub_status := 'pending'::public.subscription_status;
    v_trial_end  := NULL;
  END IF;

  v_slug := lower(regexp_replace(
    regexp_replace(
      extensions.unaccent(v_company_name),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  ));
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.organizations (
    name, type, created_by, is_active, document, slug,
    trial_started_at, trial_ends_at
  )
  VALUES (
    v_company_name, v_account_type::organization_type, NEW.id, true, NULLIF(v_document, ''), v_slug,
    CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE NULL END,
    v_trial_end
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified)
  VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  IF v_plan.id IS NOT NULL THEN
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'));
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Telefone ou documento já cadastrado em outra conta';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_account_type text, p_company_name text, p_phone text, p_plan_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing_sub_id uuid;
  v_plan record;
  v_trial_end timestamptz;
  v_sub_status public.subscription_status;
  v_clean_phone text;
  v_phone_in_use boolean := false;
  v_plan_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_account_type NOT IN ('corretor_individual', 'imobiliaria') THEN
    RAISE EXCEPTION 'Invalid account_type: %', p_account_type;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Profile/organization not found for user %', v_user_id;
  END IF;

  v_clean_phone := NULLIF(regexp_replace(COALESCE(p_phone,''), '\D', '', 'g'), '');

  IF v_clean_phone IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE regexp_replace(COALESCE(phone,''), '\D', '', 'g') = v_clean_phone
        AND user_id <> v_user_id
    ) INTO v_phone_in_use;
  END IF;

  IF v_phone_in_use THEN
    RAISE EXCEPTION 'phone_already_registered' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET
    name = COALESCE(NULLIF(trim(p_company_name), ''), name),
    type = p_account_type::public.organization_type,
    phone = COALESCE(v_clean_phone, phone),
    updated_at = now()
  WHERE id = v_org_id;

  UPDATE public.profiles
  SET
    phone = COALESCE(v_clean_phone, phone),
    onboarding_completed = true,
    updated_at = now()
  WHERE user_id = v_user_id;

  SELECT id INTO v_existing_sub_id
  FROM public.subscriptions
  WHERE organization_id = v_org_id
    AND status IN ('active', 'trial', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_sub_id IS NULL THEN
    v_plan_slug := COALESCE(p_plan_slug, 'essencial');
    IF v_plan_slug NOT IN ('essencial', 'profissional', 'business') THEN
      v_plan_slug := 'essencial';
    END IF;

    SELECT id, slug, trial_days INTO v_plan
    FROM public.subscription_plans
    WHERE slug = v_plan_slug
      AND is_active = true
      AND COALESCE(features->>'is_internal', 'false') <> 'true'
      AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true'
      AND COALESCE(features->>'is_purchasable', 'true') <> 'false'
    LIMIT 1;

    IF v_plan.id IS NOT NULL THEN
      IF v_plan.trial_days IS NOT NULL AND v_plan.trial_days > 0 THEN
        v_sub_status := 'trial'::public.subscription_status;
        v_trial_end  := now() + (v_plan.trial_days || ' days')::interval;
      ELSE
        v_sub_status := 'pending'::public.subscription_status;
        v_trial_end  := NULL;
      END IF;

      INSERT INTO public.subscriptions (
        organization_id, plan_id, status, trial_end,
        current_period_start, current_period_end
      ) VALUES (
        v_org_id, v_plan.id, v_sub_status, v_trial_end,
        now(), COALESCE(v_trial_end, now() + interval '30 days')
      );

      UPDATE public.organizations
      SET trial_started_at = CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE trial_started_at END,
          trial_ends_at = COALESCE(v_trial_end, trial_ends_at),
          updated_at = now()
      WHERE id = v_org_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'subscription_created', v_existing_sub_id IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_trial_subscription(org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  essencial_plan_id UUID;
  new_subscription_id UUID;
  v_trial_end timestamptz;
BEGIN
  SELECT id INTO essencial_plan_id
  FROM public.subscription_plans
  WHERE slug = 'essencial'
    AND is_active = true
  LIMIT 1;

  IF essencial_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano Essencial não encontrado';
  END IF;

  v_trial_end := NOW() + INTERVAL '15 days';

  INSERT INTO public.subscriptions (
    organization_id,
    plan_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    trial_end
  ) VALUES (
    org_id,
    essencial_plan_id,
    'trial',
    'monthly',
    NOW(),
    v_trial_end,
    v_trial_end
  )
  RETURNING id INTO new_subscription_id;

  UPDATE public.organizations
  SET trial_started_at = COALESCE(trial_started_at, NOW()),
      trial_ends_at = v_trial_end,
      updated_at = NOW()
  WHERE id = org_id;

  RETURN new_subscription_id;
END;
$$;
