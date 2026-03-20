-- Fix storage_provider inconsistency: images with cloudinary provider but R2 URLs
UPDATE public.property_images 
SET storage_provider = 'r2' 
WHERE storage_provider = 'cloudinary' 
AND (url LIKE '%r2.dev%' OR url LIKE '%r2.cloudflarestorage%' OR url LIKE '%pub-%');

-- Seed subscription_plans with default plans
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, max_own_properties, max_shared_properties, max_leads, max_users, marketplace_access, marketplace_views_limit, partnership_access, priority_support, features, is_active, display_order)
VALUES
  ('Gratuito', 'gratuito', 'Plano gratuito para começar', 0, 0, 5, 0, 50, 1, false, 0, false, false, '{"basic_crm": true}'::jsonb, true, 0),
  ('Starter', 'starter', 'Para corretores individuais', 79.90, 799.00, 30, 10, 300, 2, true, 500, false, false, '{"basic_crm": true, "reports": true, "ai_descriptions": true}'::jsonb, true, 1),
  ('Professional', 'professional', 'Para imobiliárias em crescimento', 199.90, 1999.00, 100, 50, 1000, 10, true, 5000, true, false, '{"basic_crm": true, "reports": true, "ai_descriptions": true, "ai_images": true, "integrations": true}'::jsonb, true, 2),
  ('Enterprise', 'enterprise', 'Para grandes operações', 499.90, 4999.00, NULL, NULL, NULL, NULL, true, NULL, true, true, '{"basic_crm": true, "reports": true, "ai_descriptions": true, "ai_images": true, "integrations": true, "api_access": true, "white_label": true}'::jsonb, true, 3);

-- Seed admin_allowlist with primary admin email
INSERT INTO public.admin_allowlist (email)
VALUES ('portocaicaraimoveis@gmail.com')
ON CONFLICT DO NOTHING;