-- Rebrand + reprice public commercial catalog: 4 plans -> 3 tiers.
--
-- Business decision (owner-approved):
--   Solo (entry)        R$ 99,90   slug: starter
--   Time (mid)          R$ 199,90  slug: profissional
--   Agência (advanced)  R$ 399,90  slug: business
--   essencial -> deactivated (is_active=false), kept in DB for existing subs.
--
-- IMPORTANT: slugs are NOT renamed (subscriptions + isPublicCommercialPlan
-- filter depend on them). Only display `name`, prices, limits and features
-- change. This mirrors the existing pattern (business already displays as a
-- different name). The initial access fee is intentionally omitted from the
-- rebuilt `features` objects (also removed by the previous migration).
--
-- Non-destructive: no plan rows deleted; no subscriptions touched. Reversible
-- by restoring previous name/price/limits and re-activating essencial.

-- 1) Solo (entry) — slug starter
UPDATE public.subscription_plans
SET
  name = 'Solo',
  description = 'Para o corretor que trabalha sozinho: imóveis, marketplace, agenda, CRM e financeiro.',
  price_monthly = 9990,
  price_yearly = 99900,
  max_own_properties = 150,
  max_leads = 250,
  max_users = 1,
  marketplace_access = true,
  priority_support = false,
  plan_type = 'plan',
  trial_days = 15,
  display_order = 1,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', 1,
    'max_own_properties', 150,
    'max_leads', 250,
    'max_marketplace_properties', 50,
    'has_schedule', true,
    'has_marketplace_publish', true,
    'has_marketplace_contact', true,
    'has_financial', true,
    'has_crm', true,
    'has_import', false,
    'has_team_management', false,
    'has_reports', false,
    'support_level', 'chat_ai'
  ),
  updated_at = now()
WHERE slug = 'starter';

-- 2) Time (mid) — slug profissional
UPDATE public.subscription_plans
SET
  name = 'Time',
  description = 'Para o corretor com equipe: mais imóveis e leads, importação e CRM com integração.',
  price_monthly = 19990,
  price_yearly = 199900,
  max_own_properties = 500,
  max_leads = 1000,
  max_users = 3,
  marketplace_access = true,
  priority_support = false,
  plan_type = 'plan',
  trial_days = 15,
  display_order = 2,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', 3,
    'max_own_properties', 500,
    'max_leads', 1000,
    'max_marketplace_properties', 200,
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

-- 3) Agência (advanced) — slug business
UPDATE public.subscription_plans
SET
  name = 'Agência',
  description = 'Para a imobiliária completa: imóveis e leads ilimitados, equipe e relatórios.',
  price_monthly = 39990,
  price_yearly = 399900,
  max_own_properties = -1,
  max_leads = -1,
  max_users = -1,
  marketplace_access = true,
  priority_support = true,
  plan_type = 'plan',
  trial_days = 15,
  display_order = 3,
  is_active = true,
  features = jsonb_build_object(
    'line', 'main',
    'is_purchasable', true,
    'max_users', -1,
    'max_own_properties', -1,
    'max_leads', -1,
    'max_marketplace_properties', -1,
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

-- 4) Retire 'essencial' from the public catalog (kept for existing subscribers).
UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE slug = 'essencial';
