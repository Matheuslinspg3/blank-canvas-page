-- Update public commercial catalog to the 3 current Porta do Corretor plans.
-- Idempotent and non-destructive: preserves slugs/subscriptions/payment history.

-- Keep internal/legacy/addon plans available in DB if needed, but hide non-current plan cards.
UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE COALESCE(plan_type, 'plan') = 'plan'
  AND slug NOT IN ('essencial', 'profissional', 'business')
  -- Preserve internal/special/manual plans that are explicitly marked as not public checkout offers.
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

-- Preserve slug 'business' for existing rules/subscriptions; only displayed name changes.
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

-- Prevent duplicated pending/confirmed local audit rows for the one-time initial property access fee,
-- while still allowing a failed/refunded attempt to be retried.
DROP INDEX IF EXISTS idx_billing_payments_initial_property_access_fee_once;
CREATE UNIQUE INDEX idx_billing_payments_initial_property_access_fee_once
  ON public.billing_payments (organization_id)
  WHERE description = 'Taxa inicial de acesso aos imóveis'
    AND status IN ('pending', 'confirmed');
