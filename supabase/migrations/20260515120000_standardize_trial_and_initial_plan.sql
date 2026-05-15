-- Standardize the commercial trial window and initial paid plan for new/future flows.
-- Safe/idempotent: updates plan catalog rows and CREATE OR REPLACE functions only.
-- Does NOT update existing subscriptions and does NOT backfill existing organizations.

-- 1) Initial paid plan: Essencial at R$100/month.
-- Current product convention stores monetary values in cents and annual pricing as
-- 10 monthly payments (roughly two months free). Therefore R$100/month => R$1,000/year.
UPDATE public.subscription_plans
SET
  price_monthly = 10000,
  price_yearly = 100000,
  trial_days = 15,
  is_active = true,
  plan_type = 'plan',
  marketplace_access = true,
  discount_percent = 0,
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'max_marketplace_properties', 20,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true
  ),
  updated_at = now()
WHERE slug = 'essencial';

-- 2) Visible paid plans: 15-day free trial and no catalog-level discount that
-- could make UI prices diverge from backend checkout charges.
UPDATE public.subscription_plans
SET
  trial_days = 15,
  discount_percent = 0,
  updated_at = now()
WHERE slug IN ('profissional', 'business')
  AND is_active = true;

-- 3) New email/password and OAuth signups: keep organization trial metadata in
-- sync with the subscription trial created for the selected plan. Existing rows
-- are intentionally untouched.
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
  v_existing_count int;
BEGIN
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_is_oauth := v_provider IS DISTINCT FROM 'email';

  -- Guard against email collisions across auth flows. This preserves the
  -- latest production behavior and avoids duplicate org/profile/subscription
  -- provisioning when an email already belongs to another auth user.
  IF NEW.email IS NOT NULL THEN
    SELECT count(*) INTO v_existing_count
    FROM auth.users
    WHERE lower(email) = lower(NEW.email)
      AND id <> NEW.id;

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED: Já existe uma conta com este email. Faça login com sua senha original ou recupere o acesso.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

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

    INSERT INTO public.organizations (
      name, type, created_by, is_active, slug,
      trial_started_at, trial_ends_at
    )
    VALUES (
      v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug,
      now(), now() + interval '15 days'
    )
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

  v_slug := lower(regexp_replace(
    regexp_replace(
      extensions.unaccent(v_company_name),
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
      v_sub_status := 'active'::public.subscription_status;
      v_trial_end  := now() + interval '15 days';
    ELSIF v_plan.trial_days IS NOT NULL AND v_plan.trial_days > 0 THEN
      v_sub_status := 'trial'::public.subscription_status;
      v_trial_end  := now() + (v_plan.trial_days || ' days')::interval;
    ELSE
      v_sub_status := 'pending'::public.subscription_status;
      v_trial_end  := NULL;
    END IF;

    IF v_trial_end IS NOT NULL THEN
      UPDATE public.organizations
      SET trial_started_at = now(), trial_ends_at = v_trial_end, updated_at = now()
      WHERE id = v_org_id;
    END IF;

    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'));
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE 'EMAIL_ALREADY_REGISTERED:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Telefone ou documento já cadastrado em outra conta';
END;
$$;

-- 4) OAuth onboarding: when it creates the first subscription, keep the
-- organization-level trial metadata aligned with subscription.trial_end.
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
    SELECT id, slug, trial_days INTO v_plan
    FROM public.subscription_plans
    WHERE slug = COALESCE(p_plan_slug, 'essencial')
      AND is_active = true
    LIMIT 1;

    IF v_plan.id IS NULL THEN
      SELECT id, slug, trial_days INTO v_plan
      FROM public.subscription_plans
      WHERE slug = 'essencial' AND is_active = true
      LIMIT 1;
    END IF;

    IF v_plan.id IS NOT NULL THEN
      IF v_plan.slug = 'gratuito' THEN
        v_sub_status := 'active'::public.subscription_status;
        v_trial_end  := now() + interval '15 days';
      ELSIF v_plan.trial_days IS NOT NULL AND v_plan.trial_days > 0 THEN
        v_sub_status := 'trial'::public.subscription_status;
        v_trial_end  := now() + (v_plan.trial_days || ' days')::interval;
      ELSE
        v_sub_status := 'pending'::public.subscription_status;
        v_trial_end  := NULL;
      END IF;

      IF v_trial_end IS NOT NULL THEN
        UPDATE public.organizations
        SET trial_started_at = now(), trial_ends_at = v_trial_end, updated_at = now()
        WHERE id = v_org_id;
      END IF;

      INSERT INTO public.subscriptions (
        organization_id, plan_id, status, trial_end,
        current_period_start, current_period_end
      ) VALUES (
        v_org_id, v_plan.id, v_sub_status, v_trial_end,
        now(), COALESCE(v_trial_end, now() + interval '30 days')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'subscription_created', v_existing_sub_id IS NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;
