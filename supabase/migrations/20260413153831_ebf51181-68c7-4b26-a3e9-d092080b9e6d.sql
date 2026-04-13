
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS automation_allowance_brl NUMERIC(12,4) NOT NULL DEFAULT 0;

-- Set allowances per plan
UPDATE public.subscription_plans SET automation_allowance_brl = 0 WHERE slug = 'gratuito';
UPDATE public.subscription_plans SET automation_allowance_brl = 2.00 WHERE slug = 'starter';
UPDATE public.subscription_plans SET automation_allowance_brl = 8.00 WHERE slug = 'essencial';
UPDATE public.subscription_plans SET automation_allowance_brl = 25.00 WHERE slug = 'profissional';
UPDATE public.subscription_plans SET automation_allowance_brl = 80.00 WHERE slug IN ('business', 'enterprise');
UPDATE public.subscription_plans SET automation_allowance_brl = 15.00 WHERE slug = 'correspondente-bancario';
