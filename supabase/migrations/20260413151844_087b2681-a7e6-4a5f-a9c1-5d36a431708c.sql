
-- Carteira de créditos de IA por organização
CREATE TABLE public.ai_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance_usd numeric(12,6) NOT NULL DEFAULT 0,
  plan_monthly_allowance_usd numeric(12,6) NOT NULL DEFAULT 0,
  total_recharged_usd numeric(12,6) NOT NULL DEFAULT 0,
  total_consumed_usd numeric(12,6) NOT NULL DEFAULT 0,
  markup_multiplier numeric(4,2) NOT NULL DEFAULT 3.00,
  last_plan_credit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.ai_credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org wallet"
  ON public.ai_credit_wallets FOR SELECT
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Histórico de transações de crédito
CREATE TABLE public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.ai_credit_wallets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_usd numeric(12,6) NOT NULL,
  balance_after numeric(12,6) NOT NULL,
  description text,
  provider text,
  model text,
  tokens_input int,
  tokens_output int,
  raw_cost_usd numeric(12,6),
  billed_cost_usd numeric(12,6),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org transactions"
  ON public.ai_credit_transactions FOR SELECT
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Índices para performance
CREATE INDEX idx_ai_credit_transactions_org_date ON public.ai_credit_transactions(organization_id, created_at DESC);
CREATE INDEX idx_ai_credit_wallets_org ON public.ai_credit_wallets(organization_id);

-- Função para deduzir créditos atomicamente (chamada pela edge function)
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_organization_id uuid,
  p_provider text,
  p_model text,
  p_tokens_input int,
  p_tokens_output int,
  p_raw_cost_usd numeric,
  p_markup_multiplier numeric DEFAULT NULL,
  p_description text DEFAULT 'Consumo WhatsApp Agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet ai_credit_wallets%ROWTYPE;
  v_markup numeric;
  v_billed numeric;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_wallet FROM ai_credit_wallets WHERE organization_id = p_organization_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  END IF;

  v_markup := COALESCE(p_markup_multiplier, v_wallet.markup_multiplier);
  v_billed := p_raw_cost_usd * v_markup;

  IF v_wallet.balance_usd < v_billed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'balance', v_wallet.balance_usd, 'required', v_billed);
  END IF;

  v_new_balance := v_wallet.balance_usd - v_billed;

  UPDATE ai_credit_wallets
  SET balance_usd = v_new_balance,
      total_consumed_usd = total_consumed_usd + v_billed,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO ai_credit_transactions (organization_id, wallet_id, type, amount_usd, balance_after, description, provider, model, tokens_input, tokens_output, raw_cost_usd, billed_cost_usd)
  VALUES (p_organization_id, v_wallet.id, 'debit', v_billed, v_new_balance, p_description, p_provider, p_model, p_tokens_input, p_tokens_output, p_raw_cost_usd, v_billed);

  RETURN jsonb_build_object('ok', true, 'billed', v_billed, 'balance', v_new_balance);
END;
$$;

-- Função para adicionar créditos (recarga ou crédito do plano)
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  p_organization_id uuid,
  p_amount_usd numeric,
  p_description text DEFAULT 'Recarga de créditos'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet ai_credit_wallets%ROWTYPE;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_wallet FROM ai_credit_wallets WHERE organization_id = p_organization_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO ai_credit_wallets (organization_id, balance_usd)
    VALUES (p_organization_id, p_amount_usd)
    RETURNING * INTO v_wallet;
    v_new_balance := p_amount_usd;
  ELSE
    v_new_balance := v_wallet.balance_usd + p_amount_usd;
    UPDATE ai_credit_wallets
    SET balance_usd = v_new_balance,
        total_recharged_usd = total_recharged_usd + p_amount_usd,
        updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  INSERT INTO ai_credit_transactions (organization_id, wallet_id, type, amount_usd, balance_after, description)
  VALUES (p_organization_id, v_wallet.id, 'credit', p_amount_usd, v_new_balance, p_description);

  RETURN jsonb_build_object('ok', true, 'balance', v_new_balance);
END;
$$;
