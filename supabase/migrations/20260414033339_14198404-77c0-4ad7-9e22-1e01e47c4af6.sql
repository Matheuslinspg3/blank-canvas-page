-- Credit all existing wallets based on their org's active plan allowance
DO $$
DECLARE
  r RECORD;
  v_new_balance NUMERIC(12,4);
BEGIN
  FOR r IN
    SELECT 
      w.id AS wallet_id,
      w.organization_id,
      w.balance_brl,
      sp.automation_allowance_brl,
      sp.name AS plan_name
    FROM automation_credit_wallets w
    JOIN subscriptions s ON s.organization_id = w.organization_id AND s.status = 'active'
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE sp.automation_allowance_brl > 0
      AND sp.slug NOT LIKE 'addon%'
  LOOP
    v_new_balance := r.balance_brl + r.automation_allowance_brl;
    
    -- Update wallet balance
    UPDATE automation_credit_wallets 
    SET balance_brl = v_new_balance,
        last_plan_credit_at = now(),
        updated_at = now()
    WHERE id = r.wallet_id;
    
    -- Record transaction
    INSERT INTO automation_credit_transactions (
      wallet_id, organization_id, type, amount_brl, balance_after, description
    ) VALUES (
      r.wallet_id, r.organization_id, 'plan_monthly', r.automation_allowance_brl, v_new_balance,
      'Crédito inicial do plano ' || r.plan_name
    );
  END LOOP;
END $$;