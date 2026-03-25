INSERT INTO subscription_plans (name, slug, plan_type, price_monthly, price_yearly, max_own_properties, max_leads, max_users, trial_days, display_order, is_active, features)
VALUES (
  'Correspondente Bancário',
  'correspondente',
  'plan',
  7990,
  79900,
  50,
  500,
  3,
  7,
  35,
  true,
  '{"line":"erp","basic_crm":true,"financial":true,"financing_simulator":true,"financing_pipeline":true,"financing_docs_checklist":true,"contracts_ai":true,"ai_credits_limit":50,"max_storage_mb":2048,"priority_support":false}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;