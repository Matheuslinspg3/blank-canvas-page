UPDATE subscription_plans 
SET 
  price_monthly = 6990, 
  price_yearly = 69900,
  features = jsonb_set(
    jsonb_set(
      features::jsonb,
      '{has_marketplace_publish}', 'false'
    ),
    '{has_marketplace_contact}', 'false'
  )
WHERE slug = 'correspondente';