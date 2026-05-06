DROP FUNCTION IF EXISTS public.deduct_automation_credits(uuid,text,text,integer,integer,numeric,numeric);

CREATE OR REPLACE FUNCTION public.deduct_automation_credits(
  p_organization_id UUID,
  p_provider TEXT,
  p_model TEXT,
  p_tokens_input INTEGER,
  p_tokens_output INTEGER,
  p_raw_cost_usd NUMERIC,
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
  v_plan_slug TEXT;
  v_is_unlimited BOOLEAN := FALSE;
BEGIN
  -- Check if organization is on internal_unlimited plan
  SELECT sp.slug INTO v_plan_slug
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organization_id = p_organization_id
  AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_plan_slug = 'internal_unlimited' THEN
    v_is_unlimited := TRUE;
  END IF;

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
  v_billed_brl := v_raw_brl * COALESCE(v_wallet.markup_multiplier, 1.0);

  -- If not unlimited and balance is insufficient, return error
  IF NOT v_is_unlimited AND v_wallet.balance_brl < v_billed_brl THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_balance',
      'balance_brl', v_wallet.balance_brl,
      'required_brl', v_billed_brl
    );
  END IF;

  -- Calculate new balance (only if not unlimited)
  IF v_is_unlimited THEN
    v_new_balance := v_wallet.balance_brl;
  ELSE
    v_new_balance := v_wallet.balance_brl - v_billed_brl;
  END IF;

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
    p_organization_id, v_wallet.id, 'usage', -v_billed_brl, v_new_balance,
    p_raw_cost_usd, v_billed_brl, p_provider, p_model,
    p_tokens_input, p_tokens_output,
    'Automação: ' || p_provider || '/' || p_model || (CASE WHEN v_is_unlimited THEN ' (Plano Ilimitado)' ELSE '' END)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'billed_brl', v_billed_brl,
    'raw_cost_usd', p_raw_cost_usd,
    'balance_after_brl', v_new_balance,
    'is_unlimited', v_is_unlimited
  );
END;
$$;