
-- Carteira de Créditos de Automação (separada de ai_credit_wallets)
CREATE TABLE public.automation_credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  plan_monthly_allowance_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  markup_multiplier NUMERIC(6,2) NOT NULL DEFAULT 3.0,
  total_consumed_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_recharged_brl NUMERIC(12,4) NOT NULL DEFAULT 0,
  last_plan_credit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org automation wallet"
  ON public.automation_credit_wallets FOR SELECT TO authenticated
  USING (public.is_org_manager_or_above(organization_id));

CREATE POLICY "Service role full access on automation wallets"
  ON public.automation_credit_wallets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Transações de Créditos de Automação
CREATE TABLE public.automation_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES public.automation_credit_wallets(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit','credit','plan_allowance','recharge','adjustment')),
  amount_brl NUMERIC(12,4) NOT NULL,
  balance_after NUMERIC(12,4) NOT NULL,
  raw_cost_usd NUMERIC(12,6),
  billed_cost_brl NUMERIC(12,4),
  provider TEXT,
  model TEXT,
  tokens_input INT,
  tokens_output INT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_act_org ON public.automation_credit_transactions(organization_id, created_at DESC);
CREATE INDEX idx_act_wallet ON public.automation_credit_transactions(wallet_id, created_at DESC);

ALTER TABLE public.automation_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org automation transactions"
  ON public.automation_credit_transactions FOR SELECT TO authenticated
  USING (public.is_org_manager_or_above(organization_id));

CREATE POLICY "Service role full access on automation transactions"
  ON public.automation_credit_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Função atômica de dedução
CREATE OR REPLACE FUNCTION public.deduct_automation_credits(
  p_organization_id UUID,
  p_provider TEXT,
  p_model TEXT,
  p_tokens_input INT DEFAULT 0,
  p_tokens_output INT DEFAULT 0,
  p_raw_cost_usd NUMERIC DEFAULT 0,
  p_usd_to_brl_rate NUMERIC DEFAULT 5.50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet automation_credit_wallets%ROWTYPE;
  v_billed_brl NUMERIC(12,4);
  v_raw_brl NUMERIC(12,4);
  v_new_balance NUMERIC(12,4);
BEGIN
  SELECT * INTO v_wallet
  FROM automation_credit_wallets
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create wallet with zero balance
    INSERT INTO automation_credit_wallets (organization_id)
    VALUES (p_organization_id)
    RETURNING * INTO v_wallet;
  END IF;

  v_raw_brl := p_raw_cost_usd * p_usd_to_brl_rate;
  v_billed_brl := v_raw_brl * v_wallet.markup_multiplier;

  IF v_wallet.balance_brl < v_billed_brl THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_balance',
      'balance_brl', v_wallet.balance_brl,
      'required_brl', v_billed_brl
    );
  END IF;

  v_new_balance := v_wallet.balance_brl - v_billed_brl;

  UPDATE automation_credit_wallets
  SET balance_brl = v_new_balance,
      total_consumed_brl = total_consumed_brl + v_billed_brl,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO automation_credit_transactions (
    organization_id, wallet_id, type, amount_brl, balance_after,
    raw_cost_usd, billed_cost_brl, provider, model,
    tokens_input, tokens_output, description
  ) VALUES (
    p_organization_id, v_wallet.id, 'debit', -v_billed_brl, v_new_balance,
    p_raw_cost_usd, v_billed_brl, p_provider, p_model,
    p_tokens_input, p_tokens_output,
    'Automação: ' || p_provider || '/' || p_model
  );

  RETURN jsonb_build_object(
    'ok', true,
    'billed_brl', v_billed_brl,
    'raw_cost_usd', p_raw_cost_usd,
    'balance_after_brl', v_new_balance
  );
END;
$$;

-- Função de adição de créditos
CREATE OR REPLACE FUNCTION public.add_automation_credits(
  p_organization_id UUID,
  p_amount_brl NUMERIC,
  p_type TEXT DEFAULT 'recharge',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet automation_credit_wallets%ROWTYPE;
  v_new_balance NUMERIC(12,4);
BEGIN
  SELECT * INTO v_wallet
  FROM automation_credit_wallets
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO automation_credit_wallets (organization_id, balance_brl)
    VALUES (p_organization_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := v_wallet.balance_brl + p_amount_brl;

  UPDATE automation_credit_wallets
  SET balance_brl = v_new_balance,
      total_recharged_brl = CASE WHEN p_type = 'recharge' THEN total_recharged_brl + p_amount_brl ELSE total_recharged_brl END,
      last_plan_credit_at = CASE WHEN p_type = 'plan_allowance' THEN now() ELSE last_plan_credit_at END,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO automation_credit_transactions (
    organization_id, wallet_id, type, amount_brl, balance_after, description
  ) VALUES (
    p_organization_id, v_wallet.id, p_type, p_amount_brl, v_new_balance,
    COALESCE(p_description, 'Crédito de automação: ' || p_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'added_brl', p_amount_brl,
    'balance_after_brl', v_new_balance
  );
END;
$$;
