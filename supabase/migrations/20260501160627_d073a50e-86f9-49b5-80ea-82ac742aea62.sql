-- Add max_custom_domains and audit decorative limits on active plans only.
-- We do NOT touch existing subscriptions or other plan fields.

UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_custom_domains}',
  to_jsonb(0)
)
WHERE slug = 'essencial' AND is_active = true;

UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_custom_domains}',
  to_jsonb(1)
)
WHERE slug = 'profissional' AND is_active = true;

UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_custom_domains}',
  to_jsonb(-1)
)
WHERE slug = 'business' AND is_active = true;

-- Internal audit marker: which JSON limits are still decorative (not enforced in code).
-- This is metadata for developers; UI does not render it.
UPDATE public.subscription_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{_decorative_limits}',
  '["max_storage_mb","ai_art_limit","ai_landing_limit","ai_video_limit","automations_limit"]'::jsonb
)
WHERE is_active = true AND plan_type = 'plan';