-- Add has_ad_generator and has_brand_settings to correspondente plan features
-- Also add these to all other plans that should have them
UPDATE subscription_plans
SET features = features || '{"has_ad_generator": false, "has_brand_settings": false}'::jsonb
WHERE slug = 'correspondente';

-- Ensure all other main plans have these features enabled
UPDATE subscription_plans
SET features = features || '{"has_ad_generator": true, "has_brand_settings": true}'::jsonb
WHERE slug IN ('starter', 'essencial', 'profissional', 'business', 'enterprise')
  AND is_active = true;

-- Gratuito: no access to these marketing features
UPDATE subscription_plans
SET features = features || '{"has_ad_generator": false, "has_brand_settings": false}'::jsonb
WHERE slug = 'gratuito';
