-- Operational slimming phase: reduce visible plans to 3 (Essencial, Profissional, Imobiliária).
-- No data is deleted. No subscriptions are touched. Old plans are only deactivated and
-- can be reactivated with a single UPDATE if needed.

-- 1) Deactivate all 'plan' type plans except the three chosen.
UPDATE public.subscription_plans
SET is_active = false
WHERE plan_type = 'plan'
  AND slug NOT IN ('essencial', 'profissional', 'business');

-- 2) Reactivate, reorder, and rename the three visible plans.
UPDATE public.subscription_plans
SET is_active = true,
    display_order = 1,
    name = 'Essencial',
    description = 'Imóveis, leads, portfólio básico e CRM simples.'
WHERE slug = 'essencial';

UPDATE public.subscription_plans
SET is_active = true,
    display_order = 2,
    name = 'Profissional',
    description = 'Tudo do Essencial + marketplace, colaboração e integrações básicas.'
WHERE slug = 'profissional';

-- 'business' keeps its slug (enterprise-class logic in useSubscription depends on it).
-- Only the displayed name changes to 'Imobiliária'.
UPDATE public.subscription_plans
SET is_active = true,
    display_order = 3,
    name = 'Imobiliária',
    description = 'Tudo do Profissional + multiusuários, administração, permissões e operação de equipe.'
WHERE slug = 'business';

-- 3) Disable developer-only feature flags on the three visible plans.
-- These features remain available in the codebase/DB and can be re-enabled later.
UPDATE public.subscription_plans
SET features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
  'has_automations',          false,
  'has_whatsapp',             false,
  'has_ad_generator',         false,
  'has_brand_settings',       false,
  'has_meta_ads',             false,
  'has_rd_station',           false,
  'has_contracts',            false,
  'has_contract_ai',          false,
  'has_pdf_extract',          false,
  'financing_simulator',      false,
  'financing_pipeline',       false,
  'financing_docs_checklist', false,
  'has_xml_feed',             false
)
WHERE slug IN ('essencial', 'profissional', 'business');