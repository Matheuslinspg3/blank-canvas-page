-- Blindagem contra provisionamento duplicado por colisão de email
-- Acrescenta guard no início do handle_new_user para abortar quando
-- já existir outro auth.users com o mesmo email (caso de email não-confirmado
-- + tentativa de OAuth com mesmo endereço).

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

  -- ─── GUARD: colisão de email entre fluxos ───
  -- Se já existe OUTRO auth.users com este email, abortamos o provisionamento
  -- para evitar duplicação de organization/profile/role/subscription.
  -- Mensagem amigável é repassada pelo GoTrue ao frontend.
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

    INSERT INTO public.organizations (name, type, created_by, is_active, slug)
    VALUES (v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.profiles (user_id, organization_id, full_name, onboarding_completed, email_verified)
    VALUES (NEW.id, v_org_id, v_full_name, false, true);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');

    RETURN NEW;
  END IF;

  -- ─── Fluxo email/senha (preservado) ───
  v_account_type  := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name  := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document      := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'gratuito');

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

    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'));
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Re-raise com mensagem original quando vier do guard
    IF SQLERRM LIKE 'EMAIL_ALREADY_REGISTERED:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Telefone ou documento já cadastrado em outra conta';
END;
$$;