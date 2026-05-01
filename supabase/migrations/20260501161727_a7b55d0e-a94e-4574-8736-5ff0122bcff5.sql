-- Restrict max_custom_domains to the agreed policy.
-- Essencial: 0, Profissional: 0, Imobiliária (business): 1.
-- Does NOT touch prices, subscriptions, or any other field.

UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_custom_domains}',
  to_jsonb(0)
)
WHERE slug IN ('essencial', 'profissional') AND is_active = true;

UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_custom_domains}',
  to_jsonb(1)
)
WHERE slug = 'business' AND is_active = true;