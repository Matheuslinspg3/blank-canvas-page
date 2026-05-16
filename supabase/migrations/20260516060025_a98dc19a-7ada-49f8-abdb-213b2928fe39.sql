-- 1. 20260516120000_update_public_commercial_plans_and_initial_fee.sql
UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE COALESCE(plan_type, 'plan') = 'plan'
  AND slug NOT IN ('essencial', 'profissional', 'business')
  AND COALESCE(features->>'is_internal', 'false') <> 'true'
  AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true'
  AND COALESCE(features->>'is_purchasable', 'true') <> 'false';

UPDATE public.subscription_plans
SET
  name = 'Plano Essencial',
  description = '50 imóveis cadastrados, agenda, marketplace de imóveis, 250 leads no CRM e financeiro.',
  price_monthly = 9990,
  price_yearly = 99900,
  max_own_properties = 50,
  max_leads = 250,
  marketplace_access = true,
  partnership_access = false,
  priority_support = false,
  plan_type = 'plan',
  trial_days = 15,
  discount_percent = 0,
  display_order = 1,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', 1,
    'max_own_properties', 50,
    'max_leads', 250,
    'max_marketplace_properties', 50,
    'initial_property_access_fee_cents', 10000,
    'has_schedule', true,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true,
    'has_financial', true,
    'has_crm', true,
    'has_import', false,
    'has_team_management', false,
    'has_reports', false,
    'support_level', 'email'
  ),
  updated_at = now()
WHERE slug = 'essencial';

UPDATE public.subscription_plans
SET
  name = 'Plano Profissional',
  description = '200 imóveis cadastrados, marketplace de imóveis, 600 leads no CRM com integração, agenda e financeiro.',
  price_monthly = 29990,
  price_yearly = 299900,
  max_own_properties = 200,
  max_leads = 600,
  marketplace_access = true,
  partnership_access = false,
  priority_support = false,
  plan_type = 'plan',
  trial_days = 15,
  discount_percent = 0,
  display_order = 2,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', 3,
    'max_own_properties', 200,
    'max_leads', 600,
    'max_marketplace_properties', 200,
    'initial_property_access_fee_cents', 10000,
    'has_schedule', true,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true,
    'has_financial', true,
    'has_crm', true,
    'has_import', true,
    'has_team_management', false,
    'has_reports', false,
    'support_level', 'email'
  ),
  updated_at = now()
WHERE slug = 'profissional';

UPDATE public.subscription_plans
SET
  name = 'Plano Imobiliária',
  description = 'Imóveis e leads ilimitados, marketplace, CRM com integração, agenda, financeiro, equipe e relatórios.',
  price_monthly = 59990,
  price_yearly = 599900,
  max_own_properties = -1,
  max_leads = -1,
  marketplace_access = true,
  partnership_access = false,
  priority_support = true,
  plan_type = 'plan',
  trial_days = 15,
  discount_percent = 0,
  display_order = 3,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', -1,
    'max_own_properties', -1,
    'max_leads', -1,
    'max_marketplace_properties', -1,
    'initial_property_access_fee_cents', 10000,
    'has_schedule', true,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true,
    'has_financial', true,
    'has_crm', true,
    'has_import', true,
    'has_team_management', true,
    'has_reports', true,
    'support_level', 'priority'
  ),
  updated_at = now()
WHERE slug = 'business';

DROP INDEX IF EXISTS idx_billing_payments_initial_property_access_fee_once;
CREATE UNIQUE INDEX idx_billing_payments_initial_property_access_fee_once
  ON public.billing_payments (organization_id)
  WHERE description = 'Taxa inicial de acesso aos imóveis'
    AND status IN ('pending', 'confirmed');

-- 2. 20260516123000_enforce_public_plan_trials.sql
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
    v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    v_slug := NULLIF(v_slug, '') || '-' || substr(md5(random()::text), 1, 6);
    IF v_slug IS NULL OR v_slug = '' THEN v_slug := 'org-' || substr(md5(random()::text), 1, 8); END IF;
    INSERT INTO public.organizations (name, type, created_by, is_active, slug) VALUES (v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug) RETURNING id INTO v_org_id;
    INSERT INTO public.profiles (user_id, organization_id, full_name, onboarding_completed, email_verified) VALUES (NEW.id, v_org_id, v_full_name, false, true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;

  v_account_type  := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name  := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document      := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'essencial');

  IF v_selected_plan NOT IN ('essencial', 'profissional', 'business') THEN v_selected_plan := 'essencial'; END IF;

  SELECT id, slug, trial_days INTO v_plan FROM public.subscription_plans WHERE slug = v_selected_plan AND is_active = true AND COALESCE(features->>'is_internal', 'false') <> 'true' AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true' AND COALESCE(features->>'is_purchasable', 'true') <> 'false' LIMIT 1;
  IF v_plan.id IS NOT NULL AND COALESCE(v_plan.trial_days, 0) > 0 THEN v_sub_status := 'trial'::public.subscription_status; v_trial_end  := now() + (v_plan.trial_days || ' days')::interval; ELSE v_sub_status := 'pending'::public.subscription_status; v_trial_end  := NULL; END IF;

  v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.organizations (name, type, created_by, is_active, document, slug, trial_started_at, trial_ends_at) VALUES (v_company_name, v_account_type::organization_type, NEW.id, true, NULLIF(v_document, ''), v_slug, CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE NULL END, v_trial_end) RETURNING id INTO v_org_id;
  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified) VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  IF v_plan.id IS NOT NULL THEN INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end) VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days')); END IF;
  RETURN NEW;
END;
$$;

-- 3. 20260516130000_reintroduce_starter_public_plan.sql
UPDATE public.subscription_plans
SET
  name = 'Starter',
  description = 'Plano de entrada para corretores: imóveis, marketplace, agenda, CRM básico e financeiro.',
  price_monthly = 5990,
  price_yearly = 59900,
  max_own_properties = 100,
  max_users = 1,
  max_leads = 100,
  marketplace_access = true,
  partnership_access = false,
  priority_support = false,
  plan_type = 'plan',
  trial_days = 15,
  discount_percent = 0,
  display_order = 1,
  is_active = true,
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'line', 'main',
    'is_internal', false,
    'is_internal_unlimited', false,
    'is_purchasable', true,
    'max_users', 1,
    'max_own_properties', 100,
    'max_leads', 100,
    'max_marketplace_properties', 20,
    'max_storage_mb', 2048,
    'ai_credits_limit', 25,
    'initial_property_access_fee_cents', 10000,
    'has_schedule', true,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true,
    'has_financial', true,
    'has_crm', true,
    'has_import', false,
    'has_team_management', false,
    'has_reports', false,
    'support_level', 'chat_ai',
    'can_buy_addon_ia', true,
    'can_buy_addon_whatsapp', false,
    'can_buy_addon_automations', false
  ),
  updated_at = now()
WHERE slug = 'starter';

INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, max_own_properties, max_users, max_leads, marketplace_access, partnership_access, priority_support, plan_type, trial_days, discount_percent, display_order, is_active, features, created_at, updated_at)
SELECT 'Starter', 'starter', 'Plano de entrada para corretores: imóveis, marketplace, agenda, CRM básico e financeiro.', 5990, 59900, 100, 1, 100, true, false, false, 'plan', 15, 0, 1, true, jsonb_build_object('line', 'main', 'is_internal', false, 'is_internal_unlimited', false, 'is_purchasable', true, 'max_users', 1, 'max_own_properties', 100, 'max_leads', 100, 'max_marketplace_properties', 20, 'max_storage_mb', 2048, 'ai_credits_limit', 25, 'initial_property_access_fee_cents', 10000, 'has_schedule', true, 'has_marketplace_publish', true, 'has_marketplace_contact', true, 'has_financial', true, 'has_crm', true, 'has_import', false, 'has_team_management', false, 'has_reports', false, 'support_level', 'chat_ai', 'can_buy_addon_ia', true, 'can_buy_addon_whatsapp', false, 'can_buy_addon_automations', false), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE slug = 'starter');

UPDATE public.subscription_plans
SET display_order = CASE slug WHEN 'starter' THEN 1 WHEN 'essencial' THEN 2 WHEN 'profissional' THEN 3 WHEN 'business' THEN 4 ELSE display_order END,
  name = CASE WHEN slug = 'business' THEN 'Plano Imobiliária' ELSE name END,
  updated_at = now()
WHERE slug IN ('starter', 'essencial', 'profissional', 'business');

-- 4. 20260516133000_fix_starter_trial_sql_defaults.sql
UPDATE public.subscription_plans
SET
  price_monthly = 10000,
  price_yearly = 100000,
  trial_days = 15,
  is_active = true,
  plan_type = 'plan',
  display_order = 1,
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'line', 'main',
    'is_internal', false,
    'is_internal_unlimited', false,
    'is_purchasable', true,
    'initial_property_access_fee_cents', 10000
  ),
  updated_at = now()
WHERE slug = 'starter';

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
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1));

  IF v_is_oauth THEN
    v_company_name := v_full_name;
    v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    v_slug := NULLIF(v_slug, '') || '-' || substr(md5(random()::text), 1, 6);
    IF v_slug IS NULL OR v_slug = '' THEN v_slug := 'org-' || substr(md5(random()::text), 1, 8); END IF;
    INSERT INTO public.organizations (name, type, created_by, is_active, slug) VALUES (v_company_name, 'imobiliaria'::organization_type, NEW.id, true, v_slug) RETURNING id INTO v_org_id;
    INSERT INTO public.profiles (user_id, organization_id, full_name, onboarding_completed, email_verified) VALUES (NEW.id, v_org_id, v_full_name, false, true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;

  v_account_type  := COALESCE(NEW.raw_user_meta_data->>'account_type', 'imobiliaria');
  v_company_name  := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_document      := COALESCE(NEW.raw_user_meta_data->>'document', '');
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'starter');

  IF v_selected_plan NOT IN ('starter', 'essencial', 'profissional', 'business') THEN v_selected_plan := 'starter'; END IF;

  SELECT id, slug, trial_days INTO v_plan FROM public.subscription_plans WHERE slug = v_selected_plan AND is_active = true AND COALESCE(features->>'is_internal', 'false') <> 'true' AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true' AND COALESCE(features->>'is_purchasable', 'true') <> 'false' LIMIT 1;
  IF v_plan.id IS NOT NULL AND COALESCE(v_plan.trial_days, 0) > 0 THEN v_sub_status := 'trial'::public.subscription_status; v_trial_end  := now() + (v_plan.trial_days || ' days')::interval; ELSE v_sub_status := 'pending'::public.subscription_status; v_trial_end  := NULL; END IF;

  v_slug := lower(regexp_replace(regexp_replace(extensions.unaccent(v_company_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.organizations (name, type, created_by, is_active, document, slug, trial_started_at, trial_ends_at) VALUES (v_company_name, v_account_type::organization_type, NEW.id, true, NULLIF(v_document, ''), v_slug, CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE NULL END, v_trial_end) RETURNING id INTO v_org_id;
  INSERT INTO public.profiles (user_id, organization_id, full_name, phone, onboarding_completed, email_verified) VALUES (NEW.id, v_org_id, v_full_name, NULLIF(v_phone, ''), true, true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  IF v_plan.id IS NOT NULL THEN INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end) VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days')); END IF;
  RETURN NEW;
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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_account_type NOT IN ('corretor_individual', 'imobiliaria') THEN RAISE EXCEPTION 'Invalid account_type: %', p_account_type; END IF;
  SELECT organization_id INTO v_org_id FROM public.profiles WHERE user_id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Profile/organization not found for user %', v_user_id; END IF;
  v_clean_phone := NULLIF(regexp_replace(COALESCE(p_phone,''), '\D', '', 'g'), '');
  IF v_clean_phone IS NOT NULL THEN SELECT EXISTS (SELECT 1 FROM public.profiles WHERE regexp_replace(COALESCE(phone,''), '\D', '', 'g') = v_clean_phone AND user_id <> v_user_id) INTO v_phone_in_use; END IF;
  IF v_phone_in_use THEN RAISE EXCEPTION 'phone_already_registered' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.organizations SET name = COALESCE(NULLIF(trim(p_company_name), ''), name), type = p_account_type::public.organization_type, phone = COALESCE(v_clean_phone, phone), updated_at = now() WHERE id = v_org_id;
  UPDATE public.profiles SET phone = COALESCE(v_clean_phone, phone), onboarding_completed = true, updated_at = now() WHERE user_id = v_user_id;
  SELECT id INTO v_existing_sub_id FROM public.subscriptions WHERE organization_id = v_org_id AND status IN ('active', 'trial', 'pending') ORDER BY created_at DESC LIMIT 1;
  IF v_existing_sub_id IS NULL THEN
    v_plan_slug := COALESCE(p_plan_slug, 'starter');
    IF v_plan_slug NOT IN ('starter', 'essencial', 'profissional', 'business') THEN v_plan_slug := 'starter'; END IF;
    SELECT id, slug, trial_days INTO v_plan FROM public.subscription_plans WHERE slug = v_plan_slug AND is_active = true AND COALESCE(features->>'is_internal', 'false') <> 'true' AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true' AND COALESCE(features->>'is_purchasable', 'true') <> 'false' LIMIT 1;
    IF v_plan.id IS NOT NULL THEN
      IF v_plan.trial_days IS NOT NULL AND v_plan.trial_days > 0 THEN v_sub_status := 'trial'::public.subscription_status; v_trial_end  := now() + (v_plan.trial_days || ' days')::interval; ELSE v_sub_status := 'pending'::public.subscription_status; v_trial_end  := NULL; END IF;
      INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end, current_period_start, current_period_end) VALUES (v_org_id, v_plan.id, v_sub_status, v_trial_end, now(), COALESCE(v_trial_end, now() + interval '30 days'));
      UPDATE public.organizations SET trial_started_at = CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE trial_started_at END, trial_ends_at = COALESCE(v_trial_end, trial_ends_at), updated_at = now() WHERE id = v_org_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('success', true, 'organization_id', v_org_id, 'subscription_created', v_existing_sub_id IS NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_trial_subscription(org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter_plan record;
  new_subscription_id UUID;
  v_trial_end timestamptz;
BEGIN
  SELECT id, trial_days INTO starter_plan FROM public.subscription_plans WHERE slug = 'starter' AND is_active = true AND COALESCE(features->>'is_internal', 'false') <> 'true' AND COALESCE(features->>'is_internal_unlimited', 'false') <> 'true' AND COALESCE(features->>'is_purchasable', 'true') <> 'false' LIMIT 1;
  IF starter_plan.id IS NULL THEN RAISE EXCEPTION 'Plano Starter não encontrado'; END IF;
  v_trial_end := NOW() + (COALESCE(NULLIF(starter_plan.trial_days, 0), 15) || ' days')::interval;
  INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_end) VALUES (org_id, starter_plan.id, 'trial', 'monthly', NOW(), v_trial_end, v_trial_end) RETURNING id INTO new_subscription_id;
  UPDATE public.organizations SET trial_started_at = COALESCE(trial_started_at, NOW()), trial_ends_at = v_trial_end, updated_at = NOW() WHERE id = org_id;
  RETURN new_subscription_id;
END;
$$;