
-- 1. Tabela ai_org_budgets: controle de gastos por org
CREATE TABLE IF NOT EXISTS public.ai_org_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_budget_usd numeric NOT NULL DEFAULT 10.00,
  alert_threshold_pct integer NOT NULL DEFAULT 80,
  action_on_limit text NOT NULL DEFAULT 'degrade' CHECK (action_on_limit IN ('degrade', 'block')),
  is_active boolean NOT NULL DEFAULT true,
  current_month_spend_usd numeric NOT NULL DEFAULT 0,
  current_month text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  last_alert_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.ai_org_budgets ENABLE ROW LEVEL SECURITY;

-- RLS: membros da org podem ver
CREATE POLICY "Members can view own org budget" ON public.ai_org_budgets
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Popular ai_billing_pricing com preços reais (Abril 2025)
INSERT INTO public.ai_billing_pricing (provider, model, price_per_1k_input_tokens, price_per_1k_output_tokens, markup_percentage, currency, is_active)
VALUES
  -- OpenAI
  ('openai', 'gpt-4o-mini', 0.000150, 0.000600, 0, 'USD', true),
  ('openai', 'gpt-4o', 0.002500, 0.010000, 0, 'USD', true),
  ('openai', 'dall-e-3', 0.040000, 0.000000, 0, 'USD', true),
  -- Groq (free tier)
  ('groq', 'llama-3.3-70b-versatile', 0.000000, 0.000000, 0, 'USD', true),
  ('groq', 'llama-3.1-8b-instant', 0.000000, 0.000000, 0, 'USD', true),
  -- Google Gemini (free tier)
  ('gemini', 'gemini-2.0-flash', 0.000000, 0.000000, 0, 'USD', true),
  ('gemini', 'gemini-1.5-flash', 0.000000, 0.000000, 0, 'USD', true),
  -- Anthropic
  ('anthropic', 'claude-3-haiku', 0.000250, 0.001250, 0, 'USD', true),
  ('anthropic', 'claude-3.5-sonnet', 0.003000, 0.015000, 0, 'USD', true)
ON CONFLICT DO NOTHING;

-- 3. Função para checar budget e acumular gasto
CREATE OR REPLACE FUNCTION public.check_ai_budget(
  p_org_id uuid,
  p_estimated_cost numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget ai_org_budgets%ROWTYPE;
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_result jsonb;
BEGIN
  -- Busca budget da org
  SELECT * INTO v_budget FROM ai_org_budgets WHERE organization_id = p_org_id AND is_active = true;
  
  -- Sem budget configurado = sem limite
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'has_budget', false, 'action', 'none');
  END IF;
  
  -- Reset mensal se mudou o mês
  IF v_budget.current_month <> v_current_month THEN
    UPDATE ai_org_budgets 
    SET current_month_spend_usd = 0, current_month = v_current_month, updated_at = now()
    WHERE id = v_budget.id;
    v_budget.current_month_spend_usd := 0;
  END IF;
  
  -- Checa se ultrapassou
  IF v_budget.current_month_spend_usd >= v_budget.monthly_budget_usd THEN
    RETURN jsonb_build_object(
      'allowed', v_budget.action_on_limit = 'degrade',
      'has_budget', true,
      'action', v_budget.action_on_limit,
      'budget_exceeded', true,
      'spent', v_budget.current_month_spend_usd,
      'limit', v_budget.monthly_budget_usd,
      'force_free', v_budget.action_on_limit = 'degrade'
    );
  END IF;
  
  -- Checa alerta
  v_result := jsonb_build_object(
    'allowed', true,
    'has_budget', true,
    'action', 'none',
    'budget_exceeded', false,
    'spent', v_budget.current_month_spend_usd,
    'limit', v_budget.monthly_budget_usd,
    'force_free', false,
    'alert', (v_budget.current_month_spend_usd / NULLIF(v_budget.monthly_budget_usd, 0) * 100) >= v_budget.alert_threshold_pct
  );
  
  RETURN v_result;
END;
$$;

-- 4. Função para registrar gasto
CREATE OR REPLACE FUNCTION public.track_ai_spend(
  p_org_id uuid,
  p_cost_usd numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_org_budgets
  SET current_month_spend_usd = current_month_spend_usd + p_cost_usd,
      updated_at = now()
  WHERE organization_id = p_org_id AND is_active = true;
END;
$$;
