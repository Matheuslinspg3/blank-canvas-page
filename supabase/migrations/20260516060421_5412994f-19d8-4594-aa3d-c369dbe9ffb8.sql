-- Remover a taxa inicial de todos os planos ativos
UPDATE public.subscription_plans
SET
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object('initial_property_access_fee_cents', 0),
  updated_at = now();

-- Remover o índice que forçava a taxa única (opcional, mas limpa o esquema)
DROP INDEX IF EXISTS idx_billing_payments_initial_property_access_fee_once;