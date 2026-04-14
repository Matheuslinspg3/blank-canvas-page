-- Update automation allowances per plan
UPDATE public.subscription_plans SET automation_allowance_brl = 0 WHERE slug = 'gratuito';
UPDATE public.subscription_plans SET automation_allowance_brl = 150.00 WHERE slug = 'starter';
UPDATE public.subscription_plans SET automation_allowance_brl = 400.00 WHERE slug = 'essencial';
UPDATE public.subscription_plans SET automation_allowance_brl = 900.00 WHERE slug = 'profissional';
UPDATE public.subscription_plans SET automation_allowance_brl = 2000.00 WHERE slug IN ('business', 'enterprise');
UPDATE public.subscription_plans SET automation_allowance_brl = 200.00 WHERE slug = 'addon-automations';
UPDATE public.subscription_plans SET automation_allowance_brl = 150.00 WHERE slug = 'correspondente-bancario';

-- Change default markup from 3.0 to 1.5
ALTER TABLE public.automation_credit_wallets ALTER COLUMN markup_multiplier SET DEFAULT 1.5;

-- Update all existing wallets to new markup
UPDATE public.automation_credit_wallets SET markup_multiplier = 1.5 WHERE markup_multiplier = 3.0;