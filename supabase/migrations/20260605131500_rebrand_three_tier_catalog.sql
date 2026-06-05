-- Rebrand/repricing: consolidate public catalog to 3 tiers (owner-approved).
--
--   Starter   (entry)  R$  99,90  slug: starter      [keep name]
--   Essencial (mid)    R$ 189,90  slug: essencial    [keep name, becomes the middle tier]
--   Imobiliária (adv)  R$ 599,90  slug: business     [keep current display name, price kept]
--   profissional -> deactivated (is_active=false), preserved for existing subs.
--
-- IMPORTANT: slugs are NOT renamed (subscriptions + isPublicCommercialPlan
-- filter depend on them). Only display name, price, limits and features change.
-- The site reads subscription_plans dynamically, so it reflects automatically.
--
-- Design fix: previously Essencial had FEWER properties (50) than Starter (100)
-- while costing more. As the new sole middle tier, Essencial now inherits the
-- former Profissional limits (200 imóveis / 600 leads / 200 marketplace / 3 users),
-- so each step up delivers more. Initial access fee intentionally omitted.
--
-- Non-destructive & reversible: no rows deleted, no subscriptions touched.

-- 1) Starter (entry) — R$ 99,90
UPDATE public.subscription_plans
SET
  name = 'Starter',
  description = 'Plano de entrada para o corretor: imóveis, marketplace, agenda, CRM e financeiro.',
  price_monthly = 9990,
  price_yearly = 99900,
  max_own_properties = 100,
  max_leads = 100,
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
    'max_own_properties', 100,
    'max_leads', 100,
    'max_marketplace_properties', 20,
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

-- 2) Essencial (middle) — R$ 189,90, inherits former Profissional limits
UPDATE public.subscription_plans
SET
  name = 'Plano Essencial',
  description = 'Para o corretor em crescimento: 200 imóveis, 600 leads, importação e CRM com integração.',
  price_monthly = 18990,
  price_yearly = 189900,
  max_own_properties = 200,
  max_leads = 600,
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
    'max_own_properties', 200,
    'max_leads', 600,
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
WHERE slug = 'essencial';

-- 3) Plano Imobiliária (advanced) — R$ 599,90, unlimited (name + price kept)
UPDATE public.subscription_plans
SET
  name = 'Plano Imobiliária',
  description = 'Para a imobiliária completa: imóveis e leads ilimitados, equipe e relatórios.',
  price_monthly = 59990,
  price_yearly = 599900,
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

-- 4) Retire 'profissional' from the public catalog (kept for existing subscribers).
UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE slug = 'profissional';
