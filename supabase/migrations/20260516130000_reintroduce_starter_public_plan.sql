-- Reintroduce starter as a public commercial plan without touching subscriptions/payments.
-- Follow-up to the 3-plan catalog migration: reuses the existing 'starter' slug when present.

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

INSERT INTO public.subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  max_own_properties,
  max_users,
  max_leads,
  marketplace_access,
  partnership_access,
  priority_support,
  plan_type,
  trial_days,
  discount_percent,
  display_order,
  is_active,
  features,
  created_at,
  updated_at
)
SELECT
  'Starter',
  'starter',
  'Plano de entrada para corretores: imóveis, marketplace, agenda, CRM básico e financeiro.',
  5990,
  59900,
  100,
  1,
  100,
  true,
  false,
  false,
  'plan',
  15,
  0,
  1,
  true,
  jsonb_build_object(
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
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE slug = 'starter'
);

-- Keep the public commercial catalog ordering explicit after adding Starter back.
UPDATE public.subscription_plans
SET display_order = CASE slug
    WHEN 'starter' THEN 1
    WHEN 'essencial' THEN 2
    WHEN 'profissional' THEN 3
    WHEN 'business' THEN 4
    ELSE display_order
  END,
  name = CASE WHEN slug = 'business' THEN 'Plano Imobiliária' ELSE name END,
  updated_at = now()
WHERE slug IN ('starter', 'essencial', 'profissional', 'business');
