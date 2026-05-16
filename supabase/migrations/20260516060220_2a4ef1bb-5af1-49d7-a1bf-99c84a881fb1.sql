UPDATE public.subscription_plans
SET
  price_monthly = 17990,
  price_yearly = 179900,
  updated_at = now()
WHERE slug = 'essencial';