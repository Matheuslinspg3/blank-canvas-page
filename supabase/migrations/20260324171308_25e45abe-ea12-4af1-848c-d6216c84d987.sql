-- Normalize plan limits from JSON features into top-level columns
-- so all limit checks/readers use consistent values.
UPDATE public.subscription_plans
SET
  max_users = CASE
    WHEN slug IN ('enterprise', 'erp-enterprise', 'combo-enterprise', 'business') THEN -1
    WHEN jsonb_typeof(features->'max_users') = 'number' THEN (features->>'max_users')::integer
    ELSE max_users
  END,
  max_own_properties = CASE
    WHEN slug IN ('enterprise', 'erp-enterprise', 'combo-enterprise', 'business') THEN -1
    WHEN jsonb_typeof(features->'max_own_properties') = 'number' THEN (features->>'max_own_properties')::integer
    ELSE max_own_properties
  END,
  max_leads = CASE
    WHEN slug IN ('enterprise', 'erp-enterprise', 'combo-enterprise', 'business') THEN -1
    WHEN jsonb_typeof(features->'max_leads') = 'number' THEN (features->>'max_leads')::integer
    ELSE max_leads
  END,
  updated_at = now()
WHERE plan_type = 'plan';