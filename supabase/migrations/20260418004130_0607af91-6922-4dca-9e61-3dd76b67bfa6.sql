-- RPC para completar onboarding de forma atômica e idempotente.
-- Funciona para usuários OAuth (atualiza placeholder + cria subscription)
-- e também para usuários email/senha (apenas marca onboarding_completed).

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_account_type text,
  p_company_name text,
  p_phone text,
  p_plan_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing_sub_id uuid;
  v_plan record;
  v_trial_end timestamptz;
  v_sub_status public.subscription_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_account_type NOT IN ('corretor_individual', 'imobiliaria') THEN
    RAISE EXCEPTION 'Invalid account_type: %', p_account_type;
  END IF;

  -- Carrega org do usuário
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Profile/organization not found for user %', v_user_id;
  END IF;

  -- Atualiza organização (sobrescreve placeholder criado no handle_new_user OAuth)
  UPDATE public.organizations
  SET
    name = COALESCE(NULLIF(trim(p_company_name), ''), name),
    type = p_account_type::public.organization_type,
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    updated_at = now()
  WHERE id = v_org_id;

  -- Atualiza profile (telefone + onboarding completo)
  UPDATE public.profiles
  SET
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    onboarding_completed = true,
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Subscription: idempotente — só cria se não existir uma ativa/trial/pending.
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

    -- Fallback para gratuito se slug inválido
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
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text) TO authenticated;