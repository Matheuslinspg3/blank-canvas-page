
-- Update handle_new_user to also create a subscription based on selected_plan_slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_invite RECORD;
  v_full_name TEXT;
  v_phone TEXT;
  v_account_type TEXT;
  v_company_name TEXT;
  v_selected_plan_slug TEXT;
  v_plan RECORD;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Extrair metadata do usuário
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'corretor_individual');
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_selected_plan_slug := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'gratuito');
  
  -- Verificar se há convite pendente
  SELECT * INTO v_invite 
  FROM public.organization_invites 
  WHERE email = LOWER(NEW.email) AND status = 'pending'
  LIMIT 1;
  
  IF v_invite IS NOT NULL THEN
    v_org_id := v_invite.organization_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invite.role);
    
    UPDATE public.organization_invites 
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;
  ELSE
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
      NEW.email,
      NEW.id
    )
    RETURNING id INTO v_org_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');

    -- Create subscription based on selected plan
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE slug = v_selected_plan_slug AND is_active = true
    LIMIT 1;

    -- Fallback to 'gratuito' if plan not found
    IF v_plan IS NULL THEN
      SELECT * INTO v_plan
      FROM public.subscription_plans
      WHERE slug = 'gratuito' AND is_active = true
      LIMIT 1;
    END IF;

    IF v_plan IS NOT NULL THEN
      -- Calculate trial end based on plan's trial_days
      IF COALESCE(v_plan.trial_days, 0) > 0 THEN
        v_trial_end := now() + (v_plan.trial_days || ' days')::interval;
      ELSE
        v_trial_end := NULL;
      END IF;

      INSERT INTO public.subscriptions (
        organization_id,
        plan_id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        trial_end,
        provider
      ) VALUES (
        v_org_id,
        v_plan.id,
        CASE 
          WHEN COALESCE(v_plan.trial_days, 0) > 0 THEN 'trial'::subscription_status
          WHEN v_plan.slug = 'gratuito' THEN 'active'::subscription_status
          ELSE 'pending'::subscription_status
        END,
        'monthly'::billing_cycle,
        now(),
        CASE
          WHEN COALESCE(v_plan.trial_days, 0) > 0 THEN now() + (v_plan.trial_days || ' days')::interval
          ELSE now() + interval '30 days'
        END,
        v_trial_end,
        'internal'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
