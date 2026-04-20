-- 1) Função pública para verificar disponibilidade de telefone (usada no onboarding)
CREATE OR REPLACE FUNCTION public.is_phone_available(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean text;
BEGIN
  v_clean := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  IF v_clean IS NULL OR length(v_clean) < 10 THEN
    RETURN true; -- entrada inválida não é "indisponível"; deixa validador de formato cuidar
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE regexp_replace(COALESCE(phone,''), '\D', '', 'g') = v_clean
      AND (v_user_id IS NULL OR user_id <> v_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_available(text) TO anon, authenticated;

-- 2) complete_onboarding agora FALHA quando telefone já está em uso
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

  -- Verifica se telefone já está em uso por OUTRO profile
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

  -- Atualiza organização
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
    WHERE slug = COALESCE(p_plan_slug, 'gratuito')
      AND is_active = true
    LIMIT 1;

    IF v_plan.id IS NULL THEN
      SELECT id, slug, trial_days INTO v_plan
      FROM public.subscription_plans
      WHERE slug = 'gratuito' AND is_active = true
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