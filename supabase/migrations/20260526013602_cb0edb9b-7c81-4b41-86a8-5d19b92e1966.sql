-- 1. Colunas
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS attribution_context jsonb;
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS attribution_context jsonb;

CREATE INDEX IF NOT EXISTS idx_organizations_attribution_gin ON public.organizations USING GIN (attribution_context);
CREATE INDEX IF NOT EXISTS idx_profiles_attribution_gin      ON public.profiles      USING GIN (attribution_context);

-- 2. Trigger handle_new_user — passa a ler attribution do raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_attribution jsonb;
BEGIN
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_is_oauth := v_provider IS DISTINCT FROM 'email';
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1));

  -- Monta attribution_context a partir do raw_user_meta_data (campos achatados pelo client)
  v_attribution := jsonb_strip_nulls(jsonb_build_object(
    'utm_source',     NULLIF(NEW.raw_user_meta_data->>'utm_source', ''),
    'utm_medium',     NULLIF(NEW.raw_user_meta_data->>'utm_medium', ''),
    'utm_campaign',   NULLIF(NEW.raw_user_meta_data->>'utm_campaign', ''),
    'utm_content',    NULLIF(NEW.raw_user_meta_data->>'utm_content', ''),
    'utm_term',       NULLIF(NEW.raw_user_meta_data->>'utm_term', ''),
    'fbclid',         NULLIF(NEW.raw_user_meta_data->>'fbclid', ''),
    'gclid',          NULLIF(NEW.raw_user_meta_data->>'gclid', ''),
    'landing_page',   NULLIF(NEW.raw_user_meta_data->>'landing_page', ''),
    'referrer',       NULLIF(NEW.raw_user_meta_data->>'referrer', ''),
    'first_seen_at',  NULLIF(NEW.raw_user_meta_data->>'first_seen_at', ''),
    'last_seen_at',   NULLIF(NEW.raw_user_meta_data->>'last_seen_at', ''),
    'session_id',     NULLIF(NEW.raw_user_meta_data->>'session_id', ''),
    'anonymous_id',   NULLIF(NEW.raw_user_meta_data->>'anonymous_id', ''),
    'provider',       v_provider,
    'captured_at',    now()::text
  ));
  IF v_attribution = '{}'::jsonb THEN v_attribution := NULL; END IF;

  IF v_is_oauth THEN
    v_company_name := v_full_name;
    v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    v_slug := NULLIF(v_slug, '') || '-' || substr(md5(random()::text), 1, 6);
    IF v_slug IS NULL OR v_slug = '' THEN v_slug := 'org-' || substr(md5(random()::text), 1, 8); END IF;
    INSERT INTO public.organizations (name, type, created_by, is_active, slug, attribution_context)
      VALUES (v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug, v_attribution)
      RETURNING id INTO v_org_id;
    INSERT INTO public.profiles (user_id, organization_id, full_name, onboarding_completed, email_verified, attribution_context)
      VALUES (NEW.id, v_org_id, v_full_name, false, true, v_attribution);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;

  v_account_type  := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name  := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document      := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'starter');

  IF v_selected_plan NOT IN ('starter', 'essencial', 'profissional', 'business') THEN v_selected_plan := 'starter'; END IF;

  SELECT id, slug, trial_days INTO v_plan FROM public.subscription_plans
    WHERE slug = v_selected_plan AND is_active = true
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

  v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.organizations (name, type, created_by, is_active, document, slug, trial_started_at, trial_ends_at, attribution_context)
    VALUES (v_company_name, v_account_type::organization_type, NEW.id, true, NULLIF(v_document, ''), v_slug,
            CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE NULL END, v_trial_end, v_attribution)
    RETURNING id INTO v_org_id;
  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified, attribution_context)
    VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true, v_attribution);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  IF v_plan.id IS NOT NULL THEN
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end, attribution_context)
      VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'), v_attribution);
  END IF;
  RETURN NEW;
END;
$function$;