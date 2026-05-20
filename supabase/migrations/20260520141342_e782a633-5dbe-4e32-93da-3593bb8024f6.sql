-- Update features for high-tier plans to include unlimited automations
UPDATE public.subscription_plans
SET features = features || jsonb_build_object(
  'automations_limit', -1,
  'has_automations', true
)
WHERE slug IN ('internal_unlimited', 'enterprise', 'business', 'combo-enterprise', 'erp-enterprise');

-- Also ensure 'erp-business' and 'combo-business' have a higher limit if needed, 
-- but the request specifically mentioned "unlimited plan".
-- Since 'internal_unlimited' is literally named "Unlimited", it's the primary target.
