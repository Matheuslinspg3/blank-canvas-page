-- Fix Essencial: max_own_properties should be 200 (between Starter 100 and Profissional 300)
UPDATE public.subscription_plans
SET max_own_properties = 200,
    features = jsonb_set(features::jsonb, '{max_own_properties}', '200')
WHERE slug = 'essencial';

-- Fix Enterprise: prices were stored as reais instead of centavos
UPDATE public.subscription_plans
SET price_monthly = 49990,
    price_yearly = 499900,
    features = jsonb_set(
      jsonb_set(features::jsonb, '{line}', '"main"'),
      '{max_own_properties}', '-1'
    ) || '{"max_leads":-1,"max_users":-1,"max_marketplace_properties":-1,"max_storage_mb":102400,"ai_credits_limit":-1,"support_level":"priority","has_priority_support":true}'::jsonb
WHERE slug = 'enterprise';